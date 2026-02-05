-- Migración: Añadir columna alias a recambios
ALTER TABLE recambios ADD COLUMN alias TEXT NOT NULL DEFAULT '';
