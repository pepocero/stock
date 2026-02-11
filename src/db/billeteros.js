/**
 * Capa de acceso a datos - Billeteros
 * Registro de billeteros retirados y sustituidos
 */

const BILLETERO_OPCIONES = ['Lithos', 'NV9', 'BT11', 'BT10'];

export { BILLETERO_OPCIONES };

export async function insertBilletero(db, data) {
  const result = await db.prepare(`
    INSERT INTO billeteros (fecha, bar, billetero_retirado, serie_retirado, billetero_suplente, serie_suplente, recuperado, pendiente, otro_billetero, serie_otro)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.fecha || null,
    data.bar || null,
    data.billetero_retirado || null,
    data.serie_retirado || null,
    data.billetero_suplente || null,
    data.serie_suplente || null,
    data.recuperado || null,
    data.pendiente || null,
    data.otro_billetero || null,
    data.serie_otro || null
  ).run();
  return result.meta.last_row_id;
}

export async function listBilleteros(db, filters = {}) {
  let query = 'SELECT id, fecha, bar, billetero_retirado, serie_retirado, billetero_suplente, serie_suplente, recuperado, pendiente, otro_billetero, serie_otro, created_at FROM billeteros WHERE 1=1';
  const params = [];

  if (filters.fecha) {
    query += ' AND fecha = ?';
    params.push(filters.fecha);
  }
  if (filters.fechaDesde) {
    query += ' AND fecha >= ?';
    params.push(filters.fechaDesde);
  }
  if (filters.fechaHasta) {
    query += ' AND fecha <= ?';
    params.push(filters.fechaHasta);
  }

  query += ' ORDER BY fecha DESC, created_at DESC';
  const result = params.length
    ? await db.prepare(query).bind(...params).all()
    : await db.prepare(query).all();
  return result.results || [];
}

export async function updateBilletero(db, id, data) {
  const allowed = ['fecha', 'bar', 'billetero_retirado', 'serie_retirado', 'billetero_suplente', 'serie_suplente', 'recuperado', 'pendiente', 'otro_billetero', 'serie_otro'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      const v = data[key];
      values.push((v === '' || v === null || v === undefined) ? null : String(v).trim() || null);
    }
  }
  if (updates.length === 0) return false;
  values.push(id);
  const result = await db.prepare(
    `UPDATE billeteros SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  return result.meta.changes > 0;
}

export async function deleteBilleteroById(db, id) {
  const result = await db.prepare('DELETE FROM billeteros WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
