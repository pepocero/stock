# Arquitectura - Stock Recambios

## Visión general

Aplicación modular preparada para crecer. **Cloudflare Pages + Functions** con D1.

Separación clara entre datos, lógica de negocio y presentación.

## Capas

```
Request → Pages Function (functions/api/) → Routes → Services → DB → D1
```

- **Middleware**: Autorización (actualmente bypass, preparado para JWT/permisos)
- **Routes**: Enrutado HTTP, validación de entrada, llamada a services
- **Services**: Reglas de negocio, validaciones
- **DB**: Queries a D1, sin lógica de negocio

## Puntos de extensión para usuarios

### 1. Middleware (`src/middleware/auth.js`)

Cuando se implemente auth:

1. Extraer token de `Authorization: Bearer <token>`
2. Validar JWT y cargar usuario
3. Añadir `user` al contexto que se pasa a las rutas
4. En `hasPermission(action, context)`, verificar `context.user.role` contra permisos

### 2. Base de datos

Tablas a crear (comentadas en schema.sql):

- `users` (id, email, password_hash, created_at, ...)
- `roles` (id, name)
- `user_roles` (user_id, role_id)
- `permissions` (id, resource, action)
- `role_permissions` (role_id, permission_id)

### 3. Multitenancy (futuro)

Si la app se usa por múltiples empresas, añadir `tenant_id` a:

- `recambios`
- `custom_fields_definitions`
- `recambios_custom_values`

Filtrar todas las queries por `tenant_id` del usuario autenticado.

### 4. Estructura de carpetas sugerida para auth

```
src/
├── auth/
│   ├── jwt.js       # Validación, generación de tokens
│   └── permissions.js
├── db/
│   └── users.js
```

## Campos personalizados

Sistema key-value extensible:

- `custom_fields_definitions`: define qué campos existen (clave, etiqueta, tipo)
- `recambios_custom_values`: valores por recambio (recambio_id, field_id, value)

Para añadir un nuevo campo: INSERT en `custom_fields_definitions`. No requiere migraciones en la tabla principal.
