-- =============================================================================
-- SCHEMA: Sistema de control de stock de recambios
-- Base de datos: Cloudflare D1 (SQLite)
-- Diseñado para escalabilidad y extensibilidad
-- =============================================================================

-- Fabricantes configurables
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

-- Tabla principal de recambios (simplificada)
DROP TABLE IF EXISTS recambios_custom_values;
DROP TABLE IF EXISTS recambios;
CREATE TABLE recambios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL DEFAULT '',
    fabricante TEXT NOT NULL,
    alias TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recambios_codigo ON recambios(codigo);
CREATE INDEX IF NOT EXISTS idx_recambios_nombre ON recambios(nombre);
CREATE INDEX IF NOT EXISTS idx_recambios_fabricante ON recambios(fabricante);
CREATE INDEX IF NOT EXISTS idx_recambios_cantidad ON recambios(cantidad);

-- Tabla utilizados: registro de recambios usados en reparaciones
CREATE TABLE IF NOT EXISTS utilizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    codigo TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_utilizados_fecha ON utilizados(fecha);
CREATE INDEX IF NOT EXISTS idx_utilizados_codigo ON utilizados(codigo);

-- Tabla recuperados: registro de recambios recibidos
CREATE TABLE IF NOT EXISTS recuperados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    codigo TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recuperados_fecha ON recuperados(fecha);
CREATE INDEX IF NOT EXISTS idx_recuperados_codigo ON recuperados(codigo);

-- =============================================================================
-- CAMPOS PERSONALIZADOS (extensibilidad) - NO USADOS POR AHORA
-- Descomentar si se necesitan en el futuro
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS custom_fields_definitions (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     field_key TEXT NOT NULL UNIQUE,
--     field_label TEXT NOT NULL,
--     field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'boolean')),
--     is_required INTEGER NOT NULL DEFAULT 0,
--     sort_order INTEGER NOT NULL DEFAULT 0,
--     created_at TEXT NOT NULL DEFAULT (datetime('now'))
-- );
-- CREATE TABLE IF NOT EXISTS recambios_custom_values (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     recambio_id INTEGER NOT NULL,
--     field_id INTEGER NOT NULL,
--     value TEXT,
--     created_at TEXT NOT NULL DEFAULT (datetime('now')),
--     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
--     FOREIGN KEY (recambio_id) REFERENCES recambios(id) ON DELETE CASCADE,
--     FOREIGN KEY (field_id) REFERENCES custom_fields_definitions(id) ON DELETE CASCADE,
--     UNIQUE(recambio_id, field_id)
-- );

-- =============================================================================
-- PREPARACIÓN PARA SISTEMA DE USUARIOS (futuro)
-- Tablas comentadas/placeholder para cuando se implemente auth
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS users (...);
-- CREATE TABLE IF NOT EXISTS roles (...);
-- CREATE TABLE IF NOT EXISTS user_roles (...);
-- CREATE TABLE IF NOT EXISTS permissions (...);
-- CREATE TABLE IF NOT EXISTS role_permissions (...);

-- (Campos personalizados: ver sección comentada arriba)
