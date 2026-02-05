/**
 * Pages Function - API catch-all
 * Maneja todas las rutas /api/*
 * params.path = "recambios" | "recambios/1" | "custom-fields" | "custom-fields/1"
 */

import { handleRecambios, handleRecambiosImport, handleRecambiosBatchDelete, handleRecambioById, handleRecambioUtilizar, handleRecambioRecuperar } from '../../src/routes/recambios.js';
import { handleUtilizados, handleUtilizadosBatchDelete } from '../../src/routes/utilizados.js';
import { handleRecuperados, handleRecuperadosBatchDelete } from '../../src/routes/recuperados.js';
import { handleCustomFields, handleCustomFieldById } from '../../src/routes/custom-fields.js';
import { handleFabricantes, handleFabricanteById } from '../../src/routes/fabricantes.js';
import { error, corsPreflight } from '../../src/utils/response.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  if (!env.DB) {
    return error('Base de datos no configurada. Verifica el binding DB en Settings → Bindings.', 503);
  }

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
      if (parts.length === 2 && parts[1] === 'import') {
        return await handleRecambiosImport(request, env);
      }
      if (parts.length === 2 && parts[1] === 'batch-delete') {
        return await handleRecambiosBatchDelete(request, env);
      }
      if (parts.length === 3 && parts[2] === 'utilizar') {
        return await handleRecambioUtilizar(request, env, parts[1]);
      }
      if (parts.length === 3 && parts[2] === 'recuperar') {
        return await handleRecambioRecuperar(request, env, parts[1]);
      }
      if (parts.length === 2) {
        return await handleRecambioById(request, env, url, parts[1]);
      }
    }

    if (parts[0] === 'custom-fields') {
      if (parts.length === 1) return await handleCustomFields(request, env);
      if (parts.length === 2) return await handleCustomFieldById(request, env, parts[1]);
    }

    if (parts[0] === 'fabricantes') {
      if (parts.length === 1) return await handleFabricantes(request, env);
      if (parts.length === 2) return await handleFabricanteById(request, env, parts[1]);
    }

    if (parts[0] === 'utilizados') {
      if (parts.length === 2 && parts[1] === 'batch-delete') return await handleUtilizadosBatchDelete(request, env);
      if (parts.length === 1) return await handleUtilizados(request, env);
    }

    if (parts[0] === 'recuperados') {
      if (parts.length === 2 && parts[1] === 'batch-delete') return await handleRecuperadosBatchDelete(request, env);
      if (parts.length === 1) return await handleRecuperados(request, env);
    }

    return error('Ruta no encontrada', 404);
  } catch (err) {
    console.error(err);
    const msg = err?.cause?.message || err?.message || 'Error interno';
    return error(msg.includes('no such table') ? 'Esquema no aplicado. Ejecuta: npm run db:migrate' : msg, 500);
  }
}
