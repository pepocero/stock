/**
 * Capa de acceso a datos - Utilizados
 * Registro de recambios usados en reparaciones
 */

export async function insertUtilizado(db, { fecha, codigo, cantidad }) {
  const result = await db.prepare(`
    INSERT INTO utilizados (fecha, codigo, cantidad)
    VALUES (?, ?, ?)
  `).bind(fecha, codigo, Math.max(0, parseInt(cantidad) || 0)).run();
  return result.meta.last_row_id;
}

export async function listUtilizados(db) {
  const result = await db.prepare(`
    SELECT id, fecha, codigo, cantidad, created_at
    FROM utilizados
    ORDER BY fecha DESC, created_at DESC
  `).all();
  return result.results || [];
}
