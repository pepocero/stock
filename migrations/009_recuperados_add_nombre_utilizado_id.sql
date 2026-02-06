-- Añadir nombre y utilizado_id a recuperados (para sincronizar con select Recuperado/Pendiente)
ALTER TABLE recuperados ADD COLUMN nombre TEXT;
ALTER TABLE recuperados ADD COLUMN utilizado_id INTEGER;
