const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Endpoint de login: autentica a un usuario y devuelve un JWT firmado.
 *
 * Body esperado: { username, password }
 *
 * Respuestas:
 *   - 200 OK: login exitoso, devuelve { token, user: { id, username, rol, nombre } }.
 *   - 400 Bad Request: faltan credenciales.
 *   - 401 Unauthorized: credenciales inválidas o usuario inactivo.
 *   - 500 Internal Server Error: error de base de datos.
 */
exports.login = (req, res) => {
  const { username, password } = req.body;

  // Validar que se envíen ambas credenciales.
  if (!username || !password) {
    return res.status(400).json({
      error: 'Credenciales incompletas',
      message: 'username y password son obligatorios.',
    });
  }

  // Buscar el usuario por username en la base de datos.
  db.get(
    `SELECT id, username, password_hash, nombre, rol, activo
     FROM usuarios
     WHERE username = ?`,
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Usuario no encontrado -> 401 (mensaje genérico para no revelar si existe).
      if (!user) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Credenciales inválidas.',
        });
      }

      // Usuario dado de baja -> 401.
      if (!user.activo) {
        return res.status(401).json({
          error: 'No autorizado',
          message: 'Usuario inactivo. Contacte al administrador.',
        });
      }

      // Comparar la contraseña enviada con el hash almacenado.
      bcrypt.compare(password, user.password_hash, (err, match) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (!match) {
          return res.status(401).json({
            error: 'No autorizado',
            message: 'Credenciales inválidas.',
          });
        }

        // Credenciales válidas. Firmar un JWT con los datos del usuario.
        const payload = {
          id: user.id,
          username: user.username,
          rol: user.rol,
          nombre: user.nombre,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        });

        // Devolver el token y los datos públicos del usuario (sin el hash).
        return res.json({
          message: 'Autenticación exitosa.',
          token,
          user: {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol: user.rol,
          },
        });
      });
    }
  );
};

/**
 * Middleware auxiliar para hashear la contraseña al crear/actualizar un usuario.
 * Se puede reutilizar en un controlador de registro de usuarios.
 */
exports.hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
};

/**
 * Endpoint público para obtener la lista de operadores activos en la pantalla
 * de "Iniciar el Día" (sin exponer contraseñas).
 */
exports.getOperators = (req, res) => {
  const query = `
    SELECT id, username, nombre, rol, activo
    FROM usuarios
    WHERE activo = 1
    ORDER BY CASE WHEN rol = 'admin' THEN 0 ELSE 1 END, nombre ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
};

