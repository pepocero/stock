/**
 * Lógica de negocio - Recambios
 * Responsabilidad: validaciones, reglas de negocio
 * Punto de extensión: aquí se añadirán checks de permisos cuando exista auth
 */

import { FABRICANTES, STOCK_BAJO_UMBRAL } from '../config.js';
import * as recambiosDb from '../db/recambios.js';

export function validarRecambio(data, excludeId = null) {
  const errors = [];

  if (!data.fabricante || !FABRICANTES.includes(data.fabricante)) {
    errors.push('fabricante: debe ser Azkoyen, Jofemar o No Asignado');
  }

  const codigo = (data.codigo_interno || '').trim();
  if (!codigo) {
    errors.push('codigo_interno: obligatorio');
  }

  const cantidad = parseInt(data.cantidad);
  if (isNaN(cantidad) || cantidad < 0) {
    errors.push('cantidad: debe ser un número >= 0');
  }

  return { valid: errors.length === 0, errors };
}

export async function crearRecambio(db, data) {
  const { valid, errors } = validarRecambio(data);
  if (!valid) {
    return { success: false, errors };
  }

  const existe = await recambiosDb.existsCodigoInterno(db, data.codigo_interno.trim());
  if (existe) {
    return { success: false, errors: ['codigo_interno: ya existe otro recambio con este código'] };
  }

  const id = await recambiosDb.createRecambio(db, {
    ...data,
    codigo_interno: data.codigo_interno.trim(),
    cantidad: Math.max(0, parseInt(data.cantidad) || 0)
  });
  return { success: true, id };
}

export async function actualizarRecambio(db, id, data) {
  const recambio = await recambiosDb.getRecambioById(db, id);
  if (!recambio) {
    return { success: false, errors: ['Recambio no encontrado'] };
  }

  const { valid, errors } = validarRecambio(data, id);
  if (!valid) {
    return { success: false, errors };
  }

  const existe = await recambiosDb.existsCodigoInterno(db, data.codigo_interno.trim(), id);
  if (existe) {
    return { success: false, errors: ['codigo_interno: ya existe otro recambio con este código'] };
  }

  await recambiosDb.updateRecambio(db, id, {
    ...data,
    codigo_interno: data.codigo_interno.trim(),
    cantidad: Math.max(0, parseInt(data.cantidad) || 0)
  });
  return { success: true };
}

export async function actualizarStock(db, id, cantidad) {
  const recambio = await recambiosDb.getRecambioById(db, id);
  if (!recambio) {
    return { success: false, errors: ['Recambio no encontrado'] };
  }

  const qty = Math.max(0, parseInt(cantidad) || 0);
  await recambiosDb.updateStock(db, id, qty);
  return { success: true };
}

export function esStockBajo(cantidad) {
  return cantidad < STOCK_BAJO_UMBRAL;
}

function normalizarFabricante(val) {
  const v = (val || '').toString().trim();
  const lower = v.toLowerCase();
  if (lower === 'azkoyen' || lower === 'azcoyen') return 'Azkoyen';
  if (lower === 'jofemar') return 'Jofemar';
  return v;
}

export async function importarRecambios(db, items) {
  const results = { created: 0, skipped: 0, errors: [] };
  const batchId = Date.now();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowNum = i + 2;

    let fabricante = normalizarFabricante(item.fabricante);
    let codigo_interno = (item.codigo_interno || '').toString().trim();
    if (!fabricante || !FABRICANTES.includes(fabricante)) fabricante = 'No Asignado';
    if (!codigo_interno) {
      const cf = (item.codigo_fabricante || '').toString().trim();
      const nt = (item.nombre_tecnico || '').toString().trim();
      codigo_interno = cf ? `${cf}-${i}` : (nt ? `${nt}-${i}` : `IMP-${batchId}-${i}`);
    }

    const data = {
      fabricante,
      codigo_interno,
      codigo_fabricante: (item.codigo_fabricante || '').toString().trim() || '',
      nombre_tecnico: (item.nombre_tecnico || '').toString().trim() || '',
      alias: (item.alias || '').toString().trim() || '',
      cantidad: parseInt(item.cantidad, 10) || 0,
      observaciones: (item.observaciones || '').toString().trim() || null
    };

    const existe = await recambiosDb.existsCodigoInterno(db, data.codigo_interno);
    if (existe) {
      results.errors.push({ row: rowNum, msg: 'código interno ya existe' });
      results.skipped++;
      continue;
    }

    try {
      await recambiosDb.createRecambio(db, data);
      results.created++;
    } catch (err) {
      results.errors.push({ row: rowNum, msg: err?.message || 'Error al crear' });
      results.skipped++;
    }
  }

  return results;
}
