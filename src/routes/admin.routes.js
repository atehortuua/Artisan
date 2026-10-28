const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const {
  authenticateToken,
  authorizeAdmin,
} = require('../middleware/auth');

// Todas las rutas de administración requieren:
// 1. Un token JWT válido (authenticateToken) -> 401 si falta/es inválido.
// 2. Rol de administrador (authorizeAdmin) -> 403 si no es admin.

router.get(
  '/dashboard',
  authenticateToken,
  authorizeAdmin,
  controller.getDashboard
);

router.get(
  '/reports/sales',
  authenticateToken,
  authorizeAdmin,
  controller.getSalesReport
);

router.get(
  '/reports/top-products',
  authenticateToken,
  authorizeAdmin,
  controller.getTopProducts
);

router.get(
  '/reports/cash-closures',
  authenticateToken,
  authorizeAdmin,
  controller.getCashClosuresReport
);

// Gestión de Cajeros y Operadores (Exclusivo Admin)
router.get(
  '/cashiers',
  authenticateToken,
  authorizeAdmin,
  controller.getUsers
);

router.post(
  '/cashiers',
  authenticateToken,
  authorizeAdmin,
  controller.createUser
);

router.patch(
  '/cashiers/:id',
  authenticateToken,
  authorizeAdmin,
  controller.updateUser
);

router.delete(
  '/cashiers/:id',
  authenticateToken,
  authorizeAdmin,
  controller.deleteUser
);

module.exports = router;
