# Stock Recambios

Sistema de control de stock de recambios para empresas de reparación de máquinas (Azcoyen, Jofemar).

**Cloudflare Pages + Functions** con base de datos D1.

## Requisitos

- Node.js 18+
- Cuenta de Cloudflare (para despliegue)

## Instalación

```bash
npm install
```

## Configuración de la base de datos

### Desarrollo local

1. Aplicar el esquema a la base de datos local (obligatorio antes del primer `npm run dev`):

```bash
npx wrangler d1 execute stock-db --local --file=./schema.sql
```

2. Iniciar el servidor:

```bash
npm run dev
```

### Producción (Cloudflare)

1. Crear la base de datos en Cloudflare:

```bash
npx wrangler d1 create stock-db
```

2. Copiar el `database_id` y pegarlo en `wrangler.toml`.

3. Aplicar el esquema a la BD remota:

```bash
npx wrangler d1 execute stock-db --remote --file=./schema.sql
```

## Desarrollo

```bash
npm run dev
```

Abre http://localhost:8788 (Pages usa el puerto 8788 por defecto).

## Despliegue

### Opción A: Conectar GitHub a Cloudflare Pages (recomendado)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Conectar el repositorio `pepocero/stock`
3. Configurar:
   - **Build command**: (vacío)
   - **Build output directory**: `public`
   - **Root directory**: `/`
4. En **Settings** → **Functions** → **D1 database bindings**: añadir `DB` → `stock-db`
5. Cada push a `main` desplegará automáticamente.

### Opción B: Deploy manual con Wrangler

```bash
# Primera vez: crear proyecto Pages (si no existe)
npx wrangler pages project create stock-recambios

# Desplegar
npm run deploy
```

## Estructura del proyecto

```
stock/
├── public/              # Frontend estático (HTML, CSS, JS)
│   ├── index.html
│   ├── css/
│   └── js/
├── functions/            # Pages Functions (API)
│   └── api/[[path]].js   # Catch-all /api/*
├── src/
│   ├── config.js        # Configuración
│   ├── db/               # Acceso a datos
│   ├── services/         # Lógica de negocio
│   ├── routes/           # Handlers API
│   ├── middleware/       # Auth (preparado para futuro)
│   └── utils/
├── schema.sql            # Esquema D1
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
| POST | /api/custom-fields | Crear campo |
| PUT | /api/custom-fields/:id | Actualizar nombre de campo |

## Campos personalizados

El sistema incluye campos extensibles. Por defecto: ubicación, proveedor, compatibilidad. Se pueden añadir y editar desde la pestaña "Campos adicionales".

## Preparación para usuarios

El código está preparado para añadir autenticación y permisos en el futuro. Ver `src/middleware/auth.js` y `docs/ARQUITECTURA.md`.
