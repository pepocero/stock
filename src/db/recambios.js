/**
 * Capa de acceso a datos - Recambios
 * Responsabilidad: ejecutar queries contra D1
 * La lógica de negocio está en services/
 */

const SORT_COLUMNS = ['codigo_interno', 'alias', 'nombre_tecnico', 'fabricante', 'cantidad', 'updated_at'];

/**
 * Lista recambios con filtros, búsqueda y ordenación
 * El listado no incluye custom_fields (se cargan en getById para rendimiento)
 */
export async function listRecambios(db, { fabricante, search, sortBy, sortOrder, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM recambios WHERE 1=1';
  const params = [];

  if (fabricante) {
    query += ' AND fabricante = ?';
    params.push(fabricante);
  }

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    query += ` AND (
      codigo_interno LIKE ? OR codigo_fabricante LIKE ? OR
      nombre_tecnico LIKE ? OR alias LIKE ? OR
      fabricante LIKE ? OR observaciones LIKE ?
    )`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const col = SORT_COLUMNS.includes(sortBy) ? sortBy : 'updated_at';
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

  if (!recambio) return null;

  const customValues = await db.prepare(`
    SELECT cfd.field_key, cfd.field_label, cfd.field_type, rcv.value
    FROM recambios_custom_values rcv
    JOIN custom_fields_definitions cfd ON cfd.id = rcv.field_id
    WHERE rcv.recambio_id = ?
    ORDER BY cfd.sort_order
  `).bind(id).all();

  const custom_fields = {};
  for (const cv of (customValues.results || [])) {
    custom_fields[cv.field_key] = {
      value: cv.value,
      label: cv.field_label,
      type: cv.field_type
    };
  }

  return { ...recambio, custom_fields };
}

/**
 * Verifica si existe un código interno
 */
export async function existsCodigoInterno(db, codigoInterno, excludeId = null) {
  let query = 'SELECT 1 FROM recambios WHERE codigo_interno = ?';
  const params = [codigoInterno];
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
    INSERT INTO recambios (fabricante, codigo_interno, codigo_fabricante, nombre_tecnico, alias, cantidad, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.fabricante,
    data.codigo_interno,
    data.codigo_fabricante || '',
    data.nombre_tecnico || '',
    data.alias || '',
    Math.max(0, parseInt(data.cantidad) || 0),
    data.observaciones || null
  ).run();

  const id = result.meta.last_row_id;
  if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
    await saveCustomValues(db, id, data.custom_fields);
  }
  return id;
}

/**
 * Actualiza un recambio
 */
export async function updateRecambio(db, id, data) {
  await db.prepare(`
    UPDATE recambios SET
      fabricante = ?,
      codigo_interno = ?,
      codigo_fabricante = ?,
      nombre_tecnico = ?,
      alias = ?,
      cantidad = ?,
      observaciones = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.fabricante,
    data.codigo_interno,
    data.codigo_fabricante || '',
    data.nombre_tecnico || '',
    data.alias || '',
    Math.max(0, parseInt(data.cantidad) || 0),
    data.observaciones ?? null,
    id
  ).run();

  if (data.custom_fields !== undefined) {
    await saveCustomValues(db, id, data.custom_fields);
  }
}

/**
 * Elimina un recambio por ID (cascade elimina recambios_custom_values)
 */
export async function deleteRecambio(db, id) {
  const result = await db.prepare('DELETE FROM recambios WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

/**
 * Actualiza solo la cantidad (stock)
 */
export async function updateStock(db, id, cantidad) {
  const qty = Math.max(0, parseInt(cantidad) || 0);
  await db.prepare(`
    UPDATE recambios SET cantidad = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(qty, id).run();
}

/**
 * Guarda valores de campos personalizados
 */
async function saveCustomValues(db, recambioId, customFields) {
  const definitions = await db.prepare('SELECT id, field_key FROM custom_fields_definitions').all();
  const fieldMap = {};
  for (const d of (definitions.results || [])) {
    fieldMap[d.field_key] = d.id;
  }

  for (const [key, val] of Object.entries(customFields)) {
    const fieldId = fieldMap[key];
    if (!fieldId) continue;

    const value = val && typeof val === 'object' ? val.value : String(val ?? '');

    await db.prepare(`
      INSERT INTO recambios_custom_values (recambio_id, field_id, value, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(recambio_id, field_id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).bind(recambioId, fieldId, value).run();
  }
}
