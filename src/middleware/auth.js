const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Middleware de autenticación: valida el token JWT enviado en la cabecera
 * Authorization: Bearer <token>.
 *
 * Si el token es válido, decodifica el payload y lo anexa a req.user para que
 * los middlewares siguientes y los controladores puedan usarlo.
 *
 * Respuestas:
 *   - 401 Unauthorized: si no hay cabecera Authorization, no empieza con "Bearer ",
 *     falta el token, el token está expirado o es inválido.
 */
exports.authenticateToken = (req, res, next) => {
  // 1. Leer la cabecera Authorization de la petición HTTP.
  const authHeader = req.headers['authorization'];

  // 2. Si no existe la cabecera, el cliente no se autenticó -> 401.
  if (authHeader == null) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Se requiere cabecera Authorization con un token JWT.',
    });
  }

  // 3. El formato esperado es "Bearer <token>". Separamos por el primer espacio.
  const parts = authHeader.split(' ');

  // 4. Validar que tenga exactamente dos partes y que la primera sea "Bearer".
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Formato de token inválido. Use: Authorization: Bearer <token>',
    });
  }

  const token = parts[1];

  // 5. Si el token está vacío -> 401.
  if (!token) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Token JWT no proporcionado.',
    });
  }

  // 6. Verificar y decodificar el token usando la clave secreta del entorno.
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Token expirado, firmado con otra clave o mal formado -> 401.
      return res.status(401).json({
        error: 'No autorizado',
        message: 'Token inválido o expirado.',
      });
    }

    // 7. El token es válido. user contiene { id, username, rol, iat, exp }.
    // Lo anexamos a la petición para los siguientes middlewares/controladores.
    req.user = user;

    // 8. Continuar al siguiente middleware o controlador.
    next();
  });
};

/**
 * Middleware de autorización por roles: verifica que el rol del usuario autenticado
 * esté incluido en la lista de roles permitidos.
 *
 * Uso: router.get('/ruta', authenticateToken, authorize('admin', 'cajero'), controller);
 *
 * Respuestas:
 *   - 401 Unauthorized: si req.user no existe (falta authenticateToken antes).
 *   - 403 Forbidden: si el usuario está autenticado pero su rol no está permitido.
 */
exports.authorize = (...permittedRoles) => {
  return (req, res, next) => {
    // 1. Si no hay req.user, authenticateToken no se ejecutó o falló antes -> 401.
    if (!req.user) {
      return res.status(401).json({
        error: 'No autorizado',
        message: 'Usuario no autenticado.',
      });
    }

    // 2. Verificar si el rol del usuario está en la lista de roles permitidos.
    const userRole = req.user.rol;

    if (!permittedRoles.includes(userRole)) {
      // 3. El usuario está autenticado pero no tiene el rol necesario -> 403.
      return res.status(403).json({
        error: 'Prohibido',
        message: `El rol "${userRole}" no tiene permiso para acceder a este recurso.`,
        roles_requeridos: permittedRoles,
      });
    }

    // 4. El rol es válido -> continuar.
    next();
  };
};

/**
 * Middleware de autorización estricta para el rol de administrador.
 * Solo permite el acceso si el usuario autenticado tiene rol 'admin'.
 *
 * Uso: router.get('/admin/dashboard', authenticateToken, authorizeAdmin, controller);
 *
 * Respuestas:
 *   - 401 Unauthorized: si no hay usuario autenticado.
 *   - 403 Forbidden: si el usuario no es administrador.
 */
exports.authorizeAdmin = (req, res, next) => {
  // 1. Validar que exista usuario autenticado en la petición.
  if (!req.user) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Usuario no autenticado.',
    });
  }

  // 2. Verificar estrictamente que el rol sea exactamente 'admin'.
  if (req.user.rol !== 'admin') {
    // 3. Autenticado pero sin rol de administrador -> 403 Forbidden.
    return res.status(403).json({
      error: 'Prohibido',
      message: 'Acceso restringido: se requiere rol de administrador.',
      rol_usuario: req.user.rol,
      rol_requerido: 'admin',
    });
  }

  // 4. Es administrador -> continuar al controlador.
  next();
};
