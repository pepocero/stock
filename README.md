# Stock Recambios

Sistema de control de stock de recambios para empresas de reparación de máquinas (Azcoyen, Jofemar).

## Requisitos

- Node.js 18+
- Cuenta de Cloudflare (para despliegue)

## Instalación

```bash
npm install
```

## Configuración de la base de datos

### Desarrollo local

1. Crear la base de datos D1 local y aplicar el esquema:

```bash
# Crear BD local (wrangler la crea automáticamente en .wrangler/)
npx wrangler d1 execute stock-db --local --file=./schema.sql
```

2. En `wrangler.toml`, el `database_id` puede dejarse como está para desarrollo local. Wrangler usa una BD temporal.

### Producción (Cloudflare)

1. Crear la base de datos en Cloudflare:

```bash
npx wrangler d1 create stock-db
```

2. Copiar el `database_id` que devuelve el comando y pegarlo en `wrangler.toml` (reemplazar `REPLACE_WITH_YOUR_DATABASE_ID`).

3. Aplicar el esquema a la BD remota:

```bash
npm run db:migrate
```

## Desarrollo

```bash
npm run dev
```

Abre http://localhost:8787

## Despliegue

```bash
npm run deploy
```

## Estructura del proyecto

```
stock/
├── public/           # Frontend estático
│   ├── index.html
│   ├── css/
│   └── js/
├── src/
│   ├── index.js      # Punto de entrada Worker
│   ├── config.js     # Configuración
│   ├── db/           # Acceso a datos
│   ├── services/     # Lógica de negocio
│   ├── routes/       # Rutas API
│   ├── middleware/   # Auth (preparado para futuro)
│   └── utils/
├── schema.sql        # Esquema D1
└── wrangler.toml
```

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/recambios | Listar (query: fabricante, search) |
| POST | /api/recambios | Crear recambio |
| GET | /api/recambios/:id | Obtener recambio |
| PUT | /api/recambios/:id | Actualizar recambio |
| PATCH | /api/recambios/:id | Actualizar parcial (ej. stock) |
| GET | /api/custom-fields | Listar campos personalizados |
| POST | /api/custom-fields | Crear campo (admin) |

## Campos personalizados

El sistema incluye campos extensibles. Por defecto vienen: ubicación, proveedor, compatibilidad. Se pueden añadir más desde la API o modificando el schema.

## Preparación para usuarios

El código está preparado para añadir autenticación y permisos en el futuro. Ver `src/middleware/auth.js` y comentarios en el código.
