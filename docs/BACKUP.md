# Backup automático D1 → R2

Backup diario de la base de datos D1 a un bucket R2, ejecutado por Cron (medianoche UTC).

## ¿Web o terminal?

| Paso                  | Desde la web (Dashboard) | Desde terminal |
|-----------------------|--------------------------|----------------|
| Crear bucket R2       | ✓ Sí                     | ✓ Sí           |
| Crear API Token       | ✓ Sí (obligatorio)       | ✗ No           |
| Ver Account ID        | ✓ Sí                     | ✓ Sí           |
| Editar wrangler.toml  | No aplica (archivo local)| ✓ Sí           |
| Añadir secreto token  | ✓ Sí (tras desplegar)    | ✓ Sí           |
| **Desplegar el Worker** | ✗ **No**               | ✓ **Obligatorio** |

**Importante:** El Worker de backup no es parte de Cloudflare Pages. Es un Worker independiente que se despliega con Wrangler. La interfaz de Pages no puede desplegar Workers custom con Workflows. **Hace falta usar la terminal al menos para el primer deploy.**

---

## Configuración inicial (pasos detallados)

### Paso 1: Obtener tu Account ID

**Opción A – Desde la web:**
1. Entra en [dash.cloudflare.com](https://dash.cloudflare.com)
2. Selecciona tu cuenta
3. La URL será algo como: `https://dash.cloudflare.com/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/...`
4. El **Account ID** es ese bloque: `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`

**Opción B – Desde terminal:**
```bash
wrangler whoami
```
En la salida aparecerá `Account ID`.

---

### Paso 2: Editar la configuración del Worker (terminal)

Abre el archivo `workers/backup/wrangler.toml` y sustituye el placeholder:

```
ACCOUNT_ID = "REEMPLAZAR_CON_TU_ACCOUNT_ID"
```

por tu Account ID real, por ejemplo:

```
ACCOUNT_ID = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

Guarda el archivo.

---

### Paso 3: Crear el bucket R2

**Opción A – Desde la web:**
1. Dashboard → menú lateral → **R2 Object Storage**
2. **Create bucket**
3. Nombre: `stock-backups`
4. **Create bucket**

**Opción B – Desde terminal:**
```bash
npm run backup:bucket:create
```

---

### Paso 4: Crear el API Token (solo web)

El token solo se crea desde el Dashboard:

1. Dashboard → clic en tu **avatar/perfil** (arriba a la derecha) → **My Profile**
2. Pestaña **API Tokens** → **Create Token**
3. Opciones:
   - **Use template:** "Edit Cloudflare Workers" (ya incluye D1), o
   - **Create Custom Token**
4. Si creas custom, configura:
   - **Permissions:** `Account` → `D1` → `Edit`
   - **Account Resources:** tu cuenta
5. **Continue to summary** → **Create Token**
6. **Copia el token** y guárdalo en un sitio seguro (solo se muestra una vez).

---

### Paso 5: Desplegar el Worker (terminal, obligatorio)

Desde la raíz del proyecto:

```bash
npm run backup:deploy
```

Si es la primera vez, Wrangler puede pedirte iniciar sesión en Cloudflare. El Worker quedará desplegado y el Cron empezará a ejecutarse cada día.

---

### Paso 6: Añadir el secreto del token

El token debe guardarse como secreto del Worker. Puedes hacerlo de dos formas:

**Opción A – Desde la web (después del deploy):**
1. Dashboard → **Workers & Pages**
2. Localiza el Worker **stock-backup** y entra
3. **Settings** → **Variables and Secrets**
4. **Add** → **Secret**
5. Nombre: `D1_REST_API_TOKEN`
6. Valor: pega el token que creaste en el Paso 4

**Opción B – Desde terminal:**
```bash
npm run backup:secret
```
Cuando Wrangler lo pida, pega el token y pulsa Enter.

---

## Verificación

1. **Ver que el Worker está desplegado:** Workers & Pages → **stock-backup**
2. **Ver el Cron:** En el Worker, pestaña **Triggers** → Crons
3. **Después del primer backup:** R2 → **stock-backups** → objetos `backup-YYYY-MM-DD.sql`
4. **Logs:** En el Worker, pestaña **Logs**

---

## Ejecución manual (terminal)

```bash
npm run backup:trigger
```

Los parámetros se leen de `workers/backup/trigger-params.json`. Si cambias de cuenta, edita ese archivo.

Para ver el estado del último backup:

```bash
wrangler workflows instances describe backup-workflow latest -c workers/backup/wrangler.toml
```

---

## Resumen de lo que necesitas hacer

| # | Acción | Dónde |
|---|--------|-------|
| 1 | Obtener Account ID | Web o terminal |
| 2 | Poner Account ID en `workers/backup/wrangler.toml` | Editor de código |
| 3 | Crear bucket R2 `stock-backups` | Web o terminal |
| 4 | Crear API Token con permiso D1 Edit | **Web (Dashboard)** |
| 5 | Desplegar el Worker | **Terminal** (`npm run backup:deploy`) |
| 6 | Añadir secreto `D1_REST_API_TOKEN` | Web o terminal |

**Funcionamiento:** Cron `0 0 * * *` (medianoche UTC). Archivos en R2: `backup-YYYY-MM-DD.sql`. Tras guardar cada backup correctamente, se eliminan los anteriores para mantener solo el último.

---

## Restaurar desde backup

Usar la REST API de import de D1 o `wrangler d1 execute` con el SQL descargado de R2.
