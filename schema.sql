-- =============================================================================
-- SCHEMA: Sistema de control de stock de recambios
-- Base de datos: Cloudflare D1 (SQLite)
-- Diseñado para escalabilidad y extensibilidad
-- =============================================================================

-- Tabla principal de recambios
CREATE TABLE IF NOT EXISTS recambios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fabricante TEXT NOT NULL CHECK (fabricante IN ('Azkoyen', 'Jofemar')),
    codigo_interno TEXT NOT NULL UNIQUE,
    codigo_fabricante TEXT NOT NULL DEFAULT '',
    nombre_tecnico TEXT NOT NULL DEFAULT '',
    alias TEXT NOT NULL DEFAULT '',
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    observaciones TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_recambios_fabricante ON recambios(fabricante);
CREATE INDEX IF NOT EXISTS idx_recambios_codigo_interno ON recambios(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_recambios_nombre_tecnico ON recambios(nombre_tecnico);
CREATE INDEX IF NOT EXISTS idx_recambios_alias ON recambios(alias);
CREATE INDEX IF NOT EXISTS idx_recambios_cantidad ON recambios(cantidad);

-- =============================================================================
-- CAMPOS PERSONALIZADOS (extensibilidad)
-- Permite agregar nuevos campos sin modificar la estructura principal
-- =============================================================================

-- Definición de campos personalizados disponibles en el sistema
CREATE TABLE IF NOT EXISTS custom_fields_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_key TEXT NOT NULL UNIQUE,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'boolean')),
    is_required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Valores de campos personalizados por recambio (relación key-value)
CREATE TABLE IF NOT EXISTS recambios_custom_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recambio_id INTEGER NOT NULL,
    field_id INTEGER NOT NULL,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (recambio_id) REFERENCES recambios(id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES custom_fields_definitions(id) ON DELETE CASCADE,
    UNIQUE(recambio_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_values_recambio ON recambios_custom_values(recambio_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_field ON recambios_custom_values(field_id);

-- =============================================================================
-- PREPARACIÓN PARA SISTEMA DE USUARIOS (futuro)
-- Tablas comentadas/placeholder para cuando se implemente auth
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS users (...);
-- CREATE TABLE IF NOT EXISTS roles (...);
-- CREATE TABLE IF NOT EXISTS user_roles (...);
-- CREATE TABLE IF NOT EXISTS permissions (...);
-- CREATE TABLE IF NOT EXISTS role_permissions (...);

-- Insertar algunos campos personalizados de ejemplo para demostración
INSERT OR IGNORE INTO custom_fields_definitions (field_key, field_label, field_type, sort_order) VALUES
    ('ubicacion', 'Ubicación física', 'text', 1),
    ('proveedor', 'Proveedor', 'text', 2),
    ('compatibilidad', 'Compatibilidad', 'text', 3);
