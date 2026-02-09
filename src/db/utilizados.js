/**
 * Capa de acceso a datos - Utilizados
 * Registro de recambios usados en reparaciones
 */

export async function insertUtilizado(db, { fecha, codigo, cantidad, nombre, recuperado = 'Pendiente' }) {
  const result = await db.prepare(`
    INSERT INTO utilizados (fecha, codigo, cantidad, nombre, recuperado)
    VALUES (?, ?, ?, ?, ?)
  `).bind(fecha, codigo, Math.max(0, parseInt(cantidad) || 0), nombre || null, recuperado === 'Recuperado' ? 'Recuperado' : 'Pendiente').run();
  return result.meta.last_row_id;
}

export async function getUtilizadoById(db, id) {
  const result = await db.prepare(`
    SELECT id, fecha, codigo, cantidad, nombre, recuperado, fecharecup, created_at
    FROM utilizados WHERE id = ?
  `).bind(id).first();
  return result || null;
}

export async function listUtilizados(db) {
  const result = await db.prepare(`
    SELECT id, fecha, codigo, cantidad, nombre, recuperado, fecharecup, created_at
    FROM utilizados
    ORDER BY fecha DESC, created_at DESC
  `).all();
  return result.results || [];
}

export async function updateRecuperado(db, id, recuperado) {
  const val = recuperado === 'Recuperado' ? 'Recuperado' : 'Pendiente';
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const fecharecup = val === 'Recuperado' ? fechaHoy : null;
  const result = await db.prepare(`
    UPDATE utilizados SET recuperado = ?, fecharecup = ? WHERE id = ?
  `).bind(val, fecharecup, id).run();
  return result.meta.changes > 0;
}

export async function deleteByFechas(db, fechas) {
  if (!fechas || fechas.length === 0) return 0;
  const placeholders = fechas.map(() => '?').join(',');
  const result = await db.prepare(
    `DELETE FROM utilizados WHERE fecha IN (${placeholders})`
  ).bind(...fechas).run();
  return result.meta.changes || 0;
}

export async function deleteUtilizadoById(db, id) {
  const result = await db.prepare('DELETE FROM utilizados WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
