const router = require('express').Router();
const authController = require('../controllers/auth.controller');

// Ruta pública de login: genera un JWT tras validar credenciales.
router.post('/login', authController.login);

// Ruta para listar operadores activos en la pantalla de Inicio del Día.
router.get('/operators', authController.getOperators);

module.exports = router;

