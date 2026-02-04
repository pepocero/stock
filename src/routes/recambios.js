/**
 * Rutas API - Recambios
 */

import { json, error } from '../utils/response.js';
import * as recambiosDb from '../db/recambios.js';
import * as recambiosService from '../services/recambios.js';
import { authMiddleware, hasPermission } from '../middleware/auth.js';

export async function handleRecambios(request, env, url) {
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

  if (!hasPermission('read', {})) {
    return error('No autorizado', 403);
  }

  if (method === 'GET') {
    const fabricante = url.searchParams.get('fabricante');
    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sortBy');
    const sortOrder = url.searchParams.get('sortOrder');
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const recambios = await recambiosDb.listRecambios(env.DB, { fabricante, search, sortBy, sortOrder, limit, offset });
    return json(recambios);
  }

  if (method === 'POST') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    const result = await recambiosService.crearRecambio(env.DB, body);
    if (!result.success) {
      return error(result.errors.join('; '), 400);
    }
    return json({ id: result.id }, 201);
  }

  return error('Método no permitido', 405);
}

export async function handleRecambioById(request, env, url, id) {
  const method = request.method;
  const recambioId = parseInt(id);
  if (isNaN(recambioId)) return error('ID inválido', 400);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;

  if (!hasPermission('read', {})) return error('No autorizado', 403);

  if (method === 'GET') {
    const recambio = await recambiosDb.getRecambioById(env.DB, recambioId);
    if (!recambio) return error('Recambio no encontrado', 404);
    return json(recambio);
  }

  if (method === 'PUT') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    const result = await recambiosService.actualizarRecambio(env.DB, recambioId, body);
    if (!result.success) {
      return error(result.errors.join('; '), 400);
    }
    return json({ ok: true });
  }

  if (method === 'PATCH') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }

    if (body.cantidad !== undefined) {
      const result = await recambiosService.actualizarStock(env.DB, recambioId, body.cantidad);
      if (!result.success) return error(result.errors.join('; '), 400);
    } else {
      const result = await recambiosService.actualizarRecambio(env.DB, recambioId, body);
      if (!result.success) return error(result.errors.join('; '), 400);
    }
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);

    const deleted = await recambiosDb.deleteRecambio(env.DB, recambioId);
    if (!deleted) return error('Recambio no encontrado', 404);
    return json({ ok: true });
  }

  return error('Método no permitido', 405);
}
