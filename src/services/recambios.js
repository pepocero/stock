/**
 * Lógica de negocio - Recambios
 * Responsabilidad: validaciones, reglas de negocio
 */

import { STOCK_BAJO_UMBRAL } from '../config.js';
import * as recambiosDb from '../db/recambios.js';
import * as utilizadosDb from '../db/utilizados.js';
import * as recuperadosDb from '../db/recuperados.js';
import * as fabricantesDb from '../db/fabricantes.js';

export async function validarRecambio(db, data, excludeId = null) {
  const errors = [];
  const fabricantes = await fabricantesDb.listFabricantes(db);
  const fabricantesNombres = fabricantes.map(f => f.nombre);

  if (!data.fabricante || !fabricantesNombres.includes(data.fabricante)) {
    errors.push('fabricante: debe ser uno de los fabricantes configurados');
  }

  const codigo = (data.codigo || '').trim();
  if (!codigo) {
    errors.push('codigo: obligatorio');
  }

  const cantidad = parseInt(data.cantidad);
  if (isNaN(cantidad) || cantidad < 0) {
    errors.push('cantidad: debe ser un número >= 0');
  }

  return { valid: errors.length === 0, errors };
}

export async function crearRecambio(db, data) {
  const { valid, errors } = await validarRecambio(db, data);
  if (!valid) {
    return { success: false, errors };
  }

  const existe = await recambiosDb.existsCodigo(db, data.codigo.trim());
  if (existe) {
    return { success: false, errors: ['codigo: ya existe otro recambio con este código'] };
  }

  const id = await recambiosDb.createRecambio(db, {
    ...data,
    codigo: data.codigo.trim(),
    cantidad: Math.max(0, parseInt(data.cantidad) || 0)
  });
  return { success: true, id };
}

export async function actualizarRecambio(db, id, data) {
  const recambio = await recambiosDb.getRecambioById(db, id);
  if (!recambio) {
    return { success: false, errors: ['Recambio no encontrado'] };
  }

  const { valid, errors } = await validarRecambio(db, data, id);
  if (!valid) {
    return { success: false, errors };
  }

  const existe = await recambiosDb.existsCodigo(db, data.codigo.trim(), id);
  if (existe) {
    return { success: false, errors: ['codigo: ya existe otro recambio con este código'] };
  }

  await recambiosDb.updateRecambio(db, id, {
    ...data,
    codigo: data.codigo.trim(),
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
  await recambiosDb.updateRecambio(db, id, { ...recambio, cantidad: qty });
  return { success: true };
}

function normalizarFechaYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return new Date().toISOString().slice(0, 10);
  const t = val.trim();
  if (!t) return new Date().toISOString().slice(0, 10);
  const mDDMM = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mDDMM) {
    const [, d, m, y] = mDDMM;
    const pad = n => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const mYYYY = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mYYYY) return t;
  return new Date().toISOString().slice(0, 10);
}

export async function registrarUtilizado(db, recambioId, { fecha, cantidad }) {
  const recambio = await recambiosDb.getRecambioById(db, recambioId);
  if (!recambio) {
    return { success: false, errors: ['Recambio no encontrado'] };
  }

  const qty = Math.max(0, Math.min(8, parseInt(cantidad) || 1));
  if (qty === 0) {
    return { success: false, errors: ['cantidad: debe ser al menos 1 para registrar uso'] };
  }

  const stockActual = recambio.cantidad || 0;
  if (stockActual < qty) {
    return { success: false, errors: [`Stock insuficiente. Disponible: ${stockActual}`] };
  }

  const fechaNorm = normalizarFechaYYYYMMDD(fecha);
  await utilizadosDb.insertUtilizado(db, {
    fecha: fechaNorm,
    codigo: recambio.codigo,
    cantidad: qty
  });
  await recambiosDb.updateCantidad(db, recambioId, -qty);
  return { success: true };
}

export async function registrarRecuperado(db, recambioId, { fecha, cantidad }) {
  const recambio = await recambiosDb.getRecambioById(db, recambioId);
  if (!recambio) {
    return { success: false, errors: ['Recambio no encontrado'] };
  }

  const qty = Math.max(0, Math.min(8, parseInt(cantidad) || 1));
  if (qty === 0) {
    return { success: false, errors: ['cantidad: debe ser al menos 1 para registrar recepción'] };
  }

  const fechaNorm = normalizarFechaYYYYMMDD(fecha);
  await recuperadosDb.insertRecuperado(db, {
    fecha: fechaNorm,
    codigo: recambio.codigo,
    cantidad: qty
  });
  await recambiosDb.updateCantidad(db, recambioId, qty);
  return { success: true };
}

export function esStockBajo(cantidad) {
  return cantidad < STOCK_BAJO_UMBRAL;
}

function normalizarFabricante(val, fabricantesNombres) {
  const v = (val || '').toString().trim();
  const lower = v.toLowerCase();
  if (lower === 'azkoyen' || lower === 'azcoyen') return fabricantesNombres.find(n => n.toLowerCase() === 'azkoyen') || 'Azkoyen';
  if (lower === 'jofemar') return fabricantesNombres.find(n => n.toLowerCase() === 'jofemar') || 'Jofemar';
  if (fabricantesNombres.includes(v)) return v;
  return fabricantesNombres.find(n => n === 'No Asignado') || fabricantesNombres[0] || 'No Asignado';
}

export async function importarRecambios(db, items) {
  const results = { created: 0, skipped: 0, errors: [] };
  const batchId = Date.now();
  const fabricantes = await fabricantesDb.listFabricantes(db);
  const fabricantesNombres = fabricantes.map(f => f.nombre);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowNum = i + 2;

    let fabricante = normalizarFabricante(item.fabricante, fabricantesNombres);
    let codigo = (item.codigo || '').toString().trim();
    if (!codigo) {
      codigo = `IMP-${batchId}-${i}`;
    }

    const data = {
      fabricante,
      codigo,
      nombre: (item.nombre || '').toString().trim() || '',
      alias: (item.alias || '').toString().trim() || '',
      cantidad: parseInt(item.cantidad, 10) || 0
    };

    const existe = await recambiosDb.existsCodigo(db, data.codigo);
    if (existe) {
      results.errors.push({ row: rowNum, msg: 'código ya existe' });
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
