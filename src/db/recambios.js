/**
 * Capa de acceso a datos - Recambios
 * Responsabilidad: ejecutar queries contra D1
 * La lógica de negocio está en services/
 */

const SORT_COLUMNS = ['codigo', 'nombre', 'fabricante', 'cantidad', 'updated_at'];

/**
 * Lista recambios con filtros, búsqueda y ordenación
 */
export async function listRecambios(db, { fabricante, search, sortBy, sortOrder, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM recambios WHERE 1=1';
  const params = [];

  if (fabricante) {
    query += ' AND fabricante = ?';
    params.push(fabricante);
  }

  if (search && search.trim()) {
    const searchTerm = `%${search.trim().toLowerCase()}%`;
    query += ` AND (
      LOWER(codigo) LIKE ? OR LOWER(nombre) LIKE ? OR LOWER(fabricante) LIKE ? OR LOWER(alias) LIKE ?
    )`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const col = SORT_COLUMNS.includes(sortBy) ? sortBy : 'nombre';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}

/**
 * Obtiene un recambio por ID
 */
export async function getRecambioById(db, id) {
  const recambio = await db.prepare(
    'SELECT * FROM recambios WHERE id = ?'
  ).bind(id).first();
  return recambio || null;
}

/**
 * Verifica si existe un código
 */
export async function existsCodigo(db, codigo, excludeId = null) {
  let query = 'SELECT 1 FROM recambios WHERE codigo = ?';
  const params = [codigo];
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  const result = await db.prepare(query).bind(...params).first();
  return !!result;
}

/**
 * Crea un nuevo recambio
 */
export async function createRecambio(db, data) {
  const result = await db.prepare(`
    INSERT INTO recambios (codigo, nombre, fabricante, alias, cantidad)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    data.codigo,
    data.nombre || '',
    data.fabricante,
    data.alias || '',
    Math.max(0, parseInt(data.cantidad) || 0)
  ).run();

  return result.meta.last_row_id;
}

/**
 * Actualiza un recambio
 */
export async function updateRecambio(db, id, data) {
  await db.prepare(`
    UPDATE recambios SET
      codigo = ?,
      nombre = ?,
      fabricante = ?,
      alias = ?,
      cantidad = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.codigo,
    data.nombre || '',
    data.fabricante,
    data.alias || '',
    Math.max(0, parseInt(data.cantidad) || 0),
    id
  ).run();
}

/**
 * Elimina un recambio por ID
 */
export async function deleteRecambio(db, id) {
  const result = await db.prepare('DELETE FROM recambios WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

/**
 * Elimina varios recambios por IDs
 */
export async function deleteRecambiosBatch(db, ids) {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.prepare(`DELETE FROM recambios WHERE id IN (${placeholders})`).bind(...ids).run();
  return result.meta.changes || 0;
}

/**
 * Actualiza solo la cantidad (stock)
 */
export async function updateCantidad(db, id, delta) {
  const recambio = await db.prepare('SELECT cantidad FROM recambios WHERE id = ?').bind(id).first();
  if (!recambio) return false;
  const nuevaCantidad = Math.max(0, (recambio.cantidad || 0) + delta);
  await db.prepare(`
    UPDATE recambios SET cantidad = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(nuevaCantidad, id).run();
  return true;
}
