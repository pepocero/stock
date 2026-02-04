-- Migración: Añadir fabricante "No Asignado" y normalizar Azcoyen -> Azkoyen
-- La base de datos puede tener CHECK (fabricante IN ('Azcoyen', 'Jofemar'))

PRAGMA defer_foreign_keys = ON;

CREATE TABLE recambios_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fabricante TEXT NOT NULL CHECK (fabricante IN ('Azkoyen', 'Jofemar', 'No Asignado')),
    codigo_interno TEXT NOT NULL UNIQUE,
    codigo_fabricante TEXT NOT NULL DEFAULT '',
    nombre_tecnico TEXT NOT NULL DEFAULT '',
    alias TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    observaciones TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO recambios_new (id, fabricante, codigo_interno, codigo_fabricante, nombre_tecnico, alias, cantidad, observaciones, created_at, updated_at)
SELECT id,
  CASE
    WHEN fabricante IN ('Azkoyen', 'Jofemar') THEN fabricante
    WHEN fabricante = 'Azcoyen' THEN 'Azkoyen'
    ELSE 'No Asignado'
  END,
  codigo_interno, codigo_fabricante, nombre_tecnico, alias, cantidad, observaciones, created_at, updated_at
FROM recambios;
DROP TABLE recambios;
ALTER TABLE recambios_new RENAME TO recambios;

CREATE INDEX IF NOT EXISTS idx_recambios_fabricante ON recambios(fabricante);
CREATE INDEX IF NOT EXISTS idx_recambios_codigo_interno ON recambios(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_recambios_nombre_tecnico ON recambios(nombre_tecnico);
CREATE INDEX IF NOT EXISTS idx_recambios_alias ON recambios(alias);
CREATE INDEX IF NOT EXISTS idx_recambios_cantidad ON recambios(cantidad);

PRAGMA defer_foreign_keys = OFF;
