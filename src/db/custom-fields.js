/**
 * Capa de acceso a datos - Campos personalizados
 */

export async function listCustomFieldDefinitions(db) {
  const result = await db.prepare(
    'SELECT * FROM custom_fields_definitions ORDER BY sort_order, field_key'
  ).all();
  return result.results || [];
}

export async function getCustomFieldByKey(db, fieldKey) {
  return await db.prepare(
    'SELECT * FROM custom_fields_definitions WHERE field_key = ?'
  ).bind(fieldKey).first();
}

export async function getCustomFieldById(db, id) {
  return await db.prepare(
    'SELECT * FROM custom_fields_definitions WHERE id = ?'
  ).bind(id).first();
}

export async function createCustomField(db, { field_key, field_label, field_type = 'text', is_required = 0, sort_order = 0 }) {
  const result = await db.prepare(`
    INSERT INTO custom_fields_definitions (field_key, field_label, field_type, is_required, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(field_key, field_label, field_type, is_required ? 1 : 0, sort_order).run();
  return result.meta.last_row_id;
}

export async function updateCustomField(db, id, { field_label, sort_order }) {
  const updates = [];
  const params = [];
  if (field_label !== undefined) {
    updates.push('field_label = ?');
    params.push(field_label.trim());
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(parseInt(sort_order) || 0);
  }
  if (updates.length === 0) return;
  params.push(id);
  await db.prepare(
    `UPDATE custom_fields_definitions SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();
}
