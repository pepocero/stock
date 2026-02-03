/**
 * Middleware de autorización - PREPARADO PARA FUTURO
 * 
 * Actualmente: permite todas las peticiones (sin autenticación)
 * Futuro: validará JWT, extraerá usuario, verificará permisos por rol
 * 
 * Puntos de extensión:
 * - Añadir verificación de token en cada request
 * - Extraer user_id del token y añadir a context
 * - Verificar permisos según ruta y rol del usuario
 */

/**
 * Middleware que procesa la petición antes de llegar a las rutas.
 * Por ahora no hace nada - placeholder para auth futuro.
 * 
 * @param {Request} request - Petición HTTP
 * @param {Object} env - Variables de entorno (incluye DB)
 * @returns {Object|null} - null si continúa, Response si debe rechazarse
 */
export function authMiddleware(request, env) {
  // Punto de extensión: cuando AUTH_ENABLED === true:
  // 1. Extraer token de Authorization header
  // 2. Validar JWT
  // 3. Cargar usuario y permisos
  // 4. Verificar que tiene permiso para la ruta solicitada
  // 5. Si no: return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  
  return null; // null = continuar con la petición
}

/**
 * Verifica si el usuario tiene permiso para una acción.
 * Por ahora siempre retorna true.
 * 
 * @param {string} action - 'read' | 'write' | 'admin'
 * @param {Object} context - Contexto con user (cuando exista)
 * @returns {boolean}
 */
export function hasPermission(action, context = {}) {
  // Punto de extensión: verificar context.user.role y permissions
  return true;
}
