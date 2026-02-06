-- Añadir columna recuperado a utilizados (Pendiente | Recuperado)
ALTER TABLE utilizados ADD COLUMN recuperado TEXT NOT NULL DEFAULT 'Pendiente';
