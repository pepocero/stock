-- Migración: Recambios de estructura antigua a nueva
-- EJECUTAR SOLO si tienes datos con estructura antigua (codigo_interno, nombre_tecnico, etc.)
-- Si ya tienes codigo/nombre (schema.sql reciente), NO ejecutes esta migración.

PRAGMA defer_foreign_keys = ON;

DROP TABLE IF EXISTS recambios_custom_values;

CREATE TABLE recambios_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
    fabricante TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO recambios_new (id, codigo, nombre, fabricante, cantidad, created_at, updated_at)
SELECT id, codigo_interno, COALESCE(NULLIF(TRIM(nombre_tecnico), ''), COALESCE(NULLIF(TRIM(alias), ''), codigo_interno)), fabricante, cantidad, created_at, updated_at
FROM recambios;

DROP TABLE recambios;
ALTER TABLE recambios_new RENAME TO recambios;

CREATE INDEX IF NOT EXISTS idx_recambios_codigo ON recambios(codigo);
CREATE INDEX IF NOT EXISTS idx_recambios_nombre ON recambios(nombre);
CREATE INDEX IF NOT EXISTS idx_recambios_fabricante ON recambios(fabricante);
CREATE INDEX IF NOT EXISTS idx_recambios_cantidad ON recambios(cantidad);

PRAGMA defer_foreign_keys = OFF;
