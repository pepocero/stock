-- Migración: Fabricantes configurables
-- Crea tabla fabricantes y quita CHECK de recambios.fabricante

CREATE TABLE IF NOT EXISTS fabricantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO fabricantes (nombre, sort_order) VALUES
    ('Azkoyen', 1),
    ('Jofemar', 2),
    ('No Asignado', 3);

-- Recrear recambios sin CHECK en fabricante
PRAGMA defer_foreign_keys = ON;

CREATE TABLE recambios_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fabricante TEXT NOT NULL,
    codigo_interno TEXT NOT NULL UNIQUE,
    codigo_fabricante TEXT NOT NULL DEFAULT '',
    nombre_tecnico TEXT NOT NULL DEFAULT '',
    alias TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    observaciones TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO recambios_new SELECT * FROM recambios;
DROP TABLE recambios;
ALTER TABLE recambios_new RENAME TO recambios;

CREATE INDEX IF NOT EXISTS idx_recambios_fabricante ON recambios(fabricante);
CREATE INDEX IF NOT EXISTS idx_recambios_codigo_interno ON recambios(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_recambios_nombre_tecnico ON recambios(nombre_tecnico);
CREATE INDEX IF NOT EXISTS idx_recambios_alias ON recambios(alias);
CREATE INDEX IF NOT EXISTS idx_recambios_cantidad ON recambios(cantidad);

PRAGMA defer_foreign_keys = OFF;
