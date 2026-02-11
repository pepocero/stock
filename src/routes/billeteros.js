/**
 * Rutas API - Billeteros
 */

import { json, error } from '../utils/response.js';
import * as billeterosDb from '../db/billeteros.js';
import { authMiddleware, hasPermission } from '../middleware/auth.js';

export async function handleBilleteros(request, env) {
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
    const url = new URL(request.url);
    const filters = {};
    const fecha = url.searchParams.get('fecha');
    if (fecha) filters.fecha = fecha;
    const fechaDesde = url.searchParams.get('fechaDesde');
    if (fechaDesde) filters.fechaDesde = fechaDesde;
    const fechaHasta = url.searchParams.get('fechaHasta');
    if (fechaHasta) filters.fechaHasta = fechaHasta;
    const items = await billeterosDb.listBilleteros(env.DB, Object.keys(filters).length ? filters : undefined);
    return json(items);
  }

  if (method === 'POST') {
    if (!hasPermission('write', {})) return error('No autorizado', 403);
    let body;
    try {
      body = await request.json();
    } catch {
      return error('JSON inválido');
    }
    const { fecha, bar, billetero_retirado, serie_retirado, billetero_suplente, serie_suplente, recuperado, pendiente, otro_billetero, serie_otro } = body;
    if (!fecha || typeof fecha !== 'string') return error('fecha es obligatoria', 400);
    const id = await billeterosDb.insertBilletero(env.DB, {
      fecha,
      bar: bar ?? null,
      billetero_retirado: billetero_retirado ?? null,
      serie_retirado: serie_retirado ?? null,
      billetero_suplente: billetero_suplente ?? null,
      serie_suplente: serie_suplente ?? null,
      recuperado: recuperado === '' ? null : (recuperado ?? null),
      pendiente: pendiente === '' ? null : (pendiente ?? null),
      otro_billetero: otro_billetero ?? null,
      serie_otro: serie_otro ?? null
    });
    return json({ id }, 201);
  }

  return error('Método no permitido', 405);
}

export async function handleBilleteroById(request, env, id) {
  const method = request.method;
  const billeteroId = parseInt(id);
  if (isNaN(billeteroId)) return error('ID inválido', 400);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const authResult = authMiddleware(request, env);
  if (authResult) return authResult;
  if (!hasPermission('write', {})) return error('No autorizado', 403);

  if (method === 'DELETE') {
    const deleted = await billeterosDb.deleteBilleteroById(env.DB, billeteroId);
    if (!deleted) return error('Registro no encontrado', 404);
    return json({ ok: true });
  }

  if (method !== 'PATCH') return error('Método no permitido', 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const validRecuperado = ['', null, 'si', 'no'];
  const validPendiente = ['', null, 'si', 'no'];
  if (body.recuperado !== undefined && !validRecuperado.includes(body.recuperado)) {
    return error('recuperado: debe ser vacío, "si" o "no"', 400);
  }
  if (body.pendiente !== undefined && !validPendiente.includes(body.pendiente)) {
    return error('pendiente: debe ser vacío, "si" o "no"', 400);
  }

  const updateData = {};
  if (body.recuperado !== undefined) updateData.recuperado = body.recuperado === '' ? null : body.recuperado;
  if (body.pendiente !== undefined) updateData.pendiente = body.pendiente === '' ? null : body.pendiente;

  const updated = await billeterosDb.updateBilletero(env.DB, billeteroId, updateData);
  if (!updated) return error('Registro no encontrado', 404);
  return json({ ok: true });
}
