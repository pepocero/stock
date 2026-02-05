/**
 * Rutas API - Fabricantes
 */

import { json, error } from '../utils/response.js';
import * as fabricantesDb from '../db/fabricantes.js';
import { authMiddleware, hasPermission } from '../middleware/auth.js';

export async function handleFabricantes(request, env) {
  const method = request.method;

  if (method === 'OPTIONS') {
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

  if (method === 'GET') {
    const fabricantes = await fabricantesDb.listFabricantes(env.DB);
    return json(fabricantes);
  }

  if (method === 'POST') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return error('nombre es obligatorio', 400);

    const existe = await fabricantesDb.getFabricanteByNombre(env.DB, nombre);
    if (existe) return error('Ya existe un fabricante con ese nombre', 400);

    const id = await fabricantesDb.createFabricante(env.DB, { nombre });
    return json({ id }, 201);
  }

  return error('Método no permitido', 405);
}

export async function handleFabricanteById(request, env, id) {
  const method = request.method;
  const fabricanteId = parseInt(id);
  if (isNaN(fabricanteId)) return error('ID inválido', 400);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;

  if (!hasPermission('read', {})) return error('No autorizado', 403);

  if (method === 'GET') {
    const fabricante = await fabricantesDb.getFabricanteById(env.DB, fabricanteId);
    if (!fabricante) return error('Fabricante no encontrado', 404);
    return json(fabricante);
  }

  if (method === 'PUT') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    const nombre = (body.nombre || '').toString().trim();
    if (!nombre) return error('nombre es obligatorio', 400);

    const fabricante = await fabricantesDb.getFabricanteById(env.DB, fabricanteId);
    if (!fabricante) return error('Fabricante no encontrado', 404);

    const existe = await fabricantesDb.getFabricanteByNombre(env.DB, nombre);
    if (existe && existe.id !== fabricanteId) return error('Ya existe un fabricante con ese nombre', 400);

    await fabricantesDb.updateFabricante(env.DB, fabricanteId, { nombre });
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    const deleted = await fabricantesDb.deleteFabricante(env.DB, fabricanteId);
    if (!deleted) return error('Fabricante no encontrado', 404);
    return json({ ok: true });
  }

  return error('Método no permitido', 405);
}
