/**
 * Capa de acceso a datos - Recuperados
 * Registro de recambios recibidos
 */

export async function insertRecuperado(db, { fecha, codigo, cantidad, nombre, utilizado_id }) {
  const result = await db.prepare(`
    INSERT INTO recuperados (fecha, codigo, cantidad, nombre, utilizado_id)
    VALUES (?, ?, ?, ?, ?)
  `).bind(fecha, codigo, Math.max(0, parseInt(cantidad) || 0), nombre || null, utilizado_id ?? null).run();
  return result.meta.last_row_id;
}

export async function listRecuperados(db) {
  const result = await db.prepare(`
    SELECT id, fecha, codigo, cantidad, nombre, utilizado_id, created_at
    FROM recuperados
    ORDER BY fecha DESC, created_at DESC
  `).all();
  return result.results || [];
}

export async function deleteByUtilizadoId(db, utilizadoId) {
  const result = await db.prepare(`
    DELETE FROM recuperados WHERE utilizado_id = ?
  `).bind(utilizadoId).run();
  return result.meta.changes > 0;
}

export async function deleteByFechas(db, fechas) {
  if (!fechas || fechas.length === 0) return 0;
  const placeholders = fechas.map(() => '?').join(',');
  const result = await db.prepare(
    `DELETE FROM recuperados WHERE fecha IN (${placeholders})`
  ).bind(...fechas).run();
  return result.meta.changes || 0;
}
