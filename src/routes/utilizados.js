/**
 * Rutas API - Utilizados
 */

import { json, error } from '../utils/response.js';
import * as utilizadosDb from '../db/utilizados.js';
import * as recuperadosDb from '../db/recuperados.js';
import { authMiddleware, hasPermission } from '../middleware/auth.js';

export async function handleUtilizados(request, env) {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const recuperado = url.searchParams.get('recuperado');
    if (recuperado) filters.recuperado = recuperado;
    const fecha = url.searchParams.get('fecha');
    if (fecha) filters.fecha = fecha;
    const fechaDesde = url.searchParams.get('fechaDesde');
    if (fechaDesde) filters.fechaDesde = fechaDesde;
    const fechaHasta = url.searchParams.get('fechaHasta');
    if (fechaHasta) filters.fechaHasta = fechaHasta;
    const items = await utilizadosDb.listUtilizados(env.DB, Object.keys(filters).length ? filters : undefined);
    return json(items);
  }

  return error('Método no permitido', 405);
}

export async function handleUtilizadosBatchDelete(request, env) {
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
  if (!hasPermission('write', {})) return error('No autorizado', 403);
  if (method !== 'POST') return error('Método no permitido', 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('JSON inválido');
  }

  const fechas = body.fechas;
  if (!Array.isArray(fechas) || fechas.length === 0) {
    return error('Se requiere un array "fechas" con al menos una fecha');
  }

  const validFechas = fechas.filter(f => typeof f === 'string' && f.trim().length > 0);
  if (validFechas.length === 0) return error('Fechas inválidas');

  const deleted = await utilizadosDb.deleteByFechas(env.DB, validFechas);
  return json({ ok: true, deleted });
}

export async function handleUtilizadoById(request, env, id) {
  const method = request.method;
  const utilId = parseInt(id);
  if (isNaN(utilId)) return error('ID inválido', 400);

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
    const deleted = await utilizadosDb.deleteUtilizadoById(env.DB, utilId);
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

  const recuperado = body.recuperado;
  if (recuperado !== 'Pendiente' && recuperado !== 'Recuperado') {
    return error('recuperado: debe ser "Pendiente" o "Recuperado"', 400);
  }

  const updated = await utilizadosDb.updateRecuperado(env.DB, utilId, recuperado);
  if (!updated) return error('Registro no encontrado', 404);
  return json({ ok: true });
}
