/**
 * Rutas API - Recuperados
 */

import { json, error } from '../utils/response.js';
import * as recuperadosDb from '../db/recuperados.js';
import { authMiddleware, hasPermission } from '../middleware/auth.js';

export async function handleRecuperados(request, env) {
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
    const items = await recuperadosDb.listRecuperados(env.DB);
    return json(items);
  }

  return error('Método no permitido', 405);
}
