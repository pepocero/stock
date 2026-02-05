/**
 * Capa de acceso a datos - Fabricantes
 */

export async function listFabricantes(db) {
  const result = await db.prepare(
    'SELECT id, nombre, sort_order FROM fabricantes ORDER BY sort_order, nombre'
  ).all();
  return result.results || [];
}

export async function getFabricanteById(db, id) {
  return await db.prepare(
    'SELECT * FROM fabricantes WHERE id = ?'
  ).bind(id).first();
}

export async function getFabricanteByNombre(db, nombre) {
  return await db.prepare(
    'SELECT * FROM fabricantes WHERE nombre = ?'
  ).bind(nombre).first();
}

export async function createFabricante(db, { nombre }) {
  const maxResult = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM fabricantes').first();
  const sortOrder = maxResult?.next_order ?? 1;
  const result = await db.prepare(
    'INSERT INTO fabricantes (nombre, sort_order) VALUES (?, ?)'
  ).bind(nombre.trim(), sortOrder).run();
  return result.meta.last_row_id;
}

export async function updateFabricante(db, id, { nombre }) {
  await db.prepare(
    'UPDATE fabricantes SET nombre = ? WHERE id = ?'
  ).bind(nombre.trim(), id).run();
}

export async function deleteFabricante(db, id) {
  const result = await db.prepare('DELETE FROM fabricantes WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
