-- Tabla billeteros: registro de billeteros retirados/sustituidos
CREATE TABLE IF NOT EXISTS billeteros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    bar TEXT,
    billetero_retirado TEXT,
    serie_retirado TEXT,
    billetero_suplente TEXT,
    serie_suplente TEXT,
    recuperado TEXT,
    pendiente TEXT,
    otro_billetero TEXT,
    serie_otro TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billeteros_fecha ON billeteros(fecha);
