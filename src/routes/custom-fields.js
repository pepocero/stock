/**
 * Rutas API - Campos personalizados
 */

import { json, error } from '../utils/response.js';
import * as customFieldsDb from '../db/custom-fields.js';
import { authMiddleware, hasPermission } from '../middleware/auth.js';

export async function handleCustomFields(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;

  if (!hasPermission('read', {})) return error('No autorizado', 403);

  if (request.method === 'GET') {
    const definitions = await customFieldsDb.listCustomFieldDefinitions(env.DB);
    return json(definitions);
  }

  if (request.method === 'POST') {
    if (!hasPermission('admin', {})) return error('No autorizado', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    const { field_key, field_label, field_type = 'text', is_required = 0, sort_order = 0 } = body;
    if (!field_key || !field_label) {
      return error('field_key y field_label son obligatorios', 400);
    }

    const validTypes = ['text', 'number', 'date', 'boolean'];
    if (!validTypes.includes(field_type)) {
      return error('field_type debe ser: text, number, date o boolean', 400);
    }

    const key = String(field_key).trim().toLowerCase().replace(/\s+/g, '_');
    const existing = await customFieldsDb.getCustomFieldByKey(env.DB, key);
    if (existing) return error('Ya existe un campo con esa clave', 400);

    const id = await customFieldsDb.createCustomField(env.DB, {
      field_key: key,
      field_label: field_label.trim(),
      field_type,
      is_required: is_required ? 1 : 0,
      sort_order: parseInt(sort_order) || 0
    });
    return json({ id }, 201);
  }

  return error('Método no permitido', 405);
}

export async function handleCustomFieldById(request, env, id) {
  const fieldId = parseInt(id);
  if (isNaN(fieldId)) return error('ID inválido', 400);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;

  if (!hasPermission('write', {})) return error('No autorizado', 403);

  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    const field = await customFieldsDb.getCustomFieldById(env.DB, fieldId);
    if (!field) return error('Campo no encontrado', 404);

    const { field_label, sort_order } = body;
    if (!field_label || typeof field_label !== 'string' || !field_label.trim()) {
      return error('field_label es obligatorio', 400);
    }

    await customFieldsDb.updateCustomField(env.DB, fieldId, {
      field_label: field_label.trim(),
      sort_order
    });
    return json({ ok: true });
  }

  return error('Método no permitido', 405);
}
