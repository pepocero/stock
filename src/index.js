/**
 * Punto de entrada - Cloudflare Worker
 * Sistema de control de stock de recambios
 *
 * Estructura de rutas:
 * GET  /api/recambios          - Listar (filtros: fabricante, search)
 * POST /api/recambios          - Crear
 * GET  /api/recambios/:id      - Obtener uno
 * PUT  /api/recambios/:id      - Actualizar completo
 * PATCH /api/recambios/:id     - Actualizar parcial (stock, etc.)
 * GET  /api/custom-fields      - Listar definiciones de campos
 * POST /api/custom-fields      - Crear campo (admin)
 * /*   - Servir frontend estático
 */

import { handleRecambios, handleRecambioById } from './routes/recambios.js';
import { handleCustomFields, handleCustomFieldById } from './routes/custom-fields.js';
import { error, corsPreflight } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsPreflight();
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    return serveStatic(request, env, url);
  }
};

async function handleApi(request, env, url) {
  const path = url.pathname.slice(4);
  const parts = path.split('/').filter(Boolean);

  try {
    if (parts[0] === 'recambios') {
      if (parts.length === 1) {
        return await handleRecambios(request, env, url);
      }
      if (parts.length === 2) {
        return await handleRecambioById(request, env, url, parts[1]);
      }
    }

    if (parts[0] === 'custom-fields') {
      if (parts.length === 1) return await handleCustomFields(request, env);
      if (parts.length === 2) return await handleCustomFieldById(request, env, parts[1]);
    }

    return error('Ruta no encontrada', 404);
  } catch (err) {
    console.error(err);
    return error('Error interno del servidor', 500);
  }
}

async function serveStatic(request, env, url) {
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!path.startsWith('/')) path = '/' + path;

  const assetRequest = new Request(url.origin + path, request);
  const response = await env.ASSETS.fetch(assetRequest);
  if (response.status !== 404) return response;

  return env.ASSETS.fetch(new Request(url.origin + '/index.html', request));
}
