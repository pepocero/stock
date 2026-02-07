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
    const codigo = url.searchParams.get('codigo');
    const sortBy = url.searchParams.get('sortBy');
    const sortOrder = url.searchParams.get('sortOrder');
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const recambios = await recambiosDb.listRecambios(env.DB, { fabricante, search, codigo, sortBy, sortOrder, limit, offset });
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

export async function handleRecambioUtilizar(request, env, id) {
  const method = request.method;
  const recambioId = parseInt(id);
  if (isNaN(recambioId)) return error('ID inválido', 400);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;
  if (!hasPermission('write', {})) return error('No autorizado', 403);
  if (method !== 'POST') return error('Método no permitido', 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const result = await recambiosService.registrarUtilizado(env.DB, recambioId, {
    fecha: body.fecha,
    cantidad: body.cantidad,
    usado: !!body.usado
  });
  if (!result.success) {
    return error(result.errors.join('; '), 400);
  }
  return json({ ok: true });
}

export async function handleRecambioRecuperar(request, env, id) {
  const method = request.method;
  const recambioId = parseInt(id);
  if (isNaN(recambioId)) return error('ID inválido', 400);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;
  if (!hasPermission('write', {})) return error('No autorizado', 403);
  if (method !== 'POST') return error('Método no permitido', 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const result = await recambiosService.registrarRecuperado(env.DB, recambioId, {
    fecha: body.fecha,
    cantidad: body.cantidad
  });
  if (!result.success) {
    return error(result.errors.join('; '), 400);
  }
  return json({ ok: true });
}

export async function handleRecambiosImport(request, env) {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;

  if (method !== 'POST') {
    return error('Método no permitido', 405);
  }

  if (!hasPermission('write', {})) return error('No autorizado', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return error('Se requiere un array "items" con al menos un recambio');
  }

  if (items.length > 500) {
    return error('Máximo 500 recambios por importación');
  }

  const result = await recambiosService.importarRecambios(env.DB, items);
  return json(result);
}

export async function handleRecambiosBatchDelete(request, env) {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;

  if (method !== 'POST') {
    return error('Método no permitido', 405);
  }

  if (!hasPermission('write', {})) return error('No autorizado', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return error('Se requiere un array "ids" con al menos un ID');
  }

  const validIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
  if (validIds.length === 0) {
    return error('IDs inválidos');
  }

  const deleted = await recambiosDb.deleteRecambiosBatch(env.DB, validIds);
  return json({ ok: true, deleted });
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
