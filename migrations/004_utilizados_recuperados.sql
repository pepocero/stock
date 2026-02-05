-- Migración: Crear tablas utilizados y recuperados
-- Seguro ejecutar siempre (CREATE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS utilizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    codigo TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_utilizados_fecha ON utilizados(fecha);
CREATE INDEX IF NOT EXISTS idx_utilizados_codigo ON utilizados(codigo);

CREATE TABLE IF NOT EXISTS recuperados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    codigo TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recuperados_fecha ON recuperados(fecha);
CREATE INDEX IF NOT EXISTS idx_recuperados_codigo ON recuperados(codigo);
