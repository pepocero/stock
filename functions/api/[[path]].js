/**
 * Pages Function - API catch-all
 * Maneja todas las rutas /api/*
 * params.path = "recambios" | "recambios/1" | "custom-fields" | "custom-fields/1"
 */

import { handleRecambios, handleRecambioById } from '../../src/routes/recambios.js';
import { handleCustomFields, handleCustomFieldById } from '../../src/routes/custom-fields.js';
import { error, corsPreflight } from '../../src/utils/response.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return corsPreflight();
  }

  const pathParam = Array.isArray(params?.path)
    ? params.path.join('/')
    : (typeof params?.path === 'string' ? params.path : '');
  const parts = pathParam.split('/').filter(Boolean);

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
