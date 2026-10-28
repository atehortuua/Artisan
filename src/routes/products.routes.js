const router = require('express').Router();
const controller = require('../controllers/products.controller');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

// ============================================================
// LECTURA DE CATÁLOGO (Cajeros y Administradores autenticados)
// ============================================================
router.get('/', authenticateToken, controller.getProducts);
router.get('/categories', authenticateToken, controller.getCategories);
router.get('/modifiers', authenticateToken, controller.getModifiers);

// ============================================================
// GESTIÓN EXCLUSIVA DE ADMINISTRADOR (Productos, Categorías y Stock)
// ============================================================
router.post('/', authenticateToken, authorizeAdmin, controller.createProduct);
router.put('/:id', authenticateToken, authorizeAdmin, controller.updateProduct);
router.delete('/:id', authenticateToken, authorizeAdmin, controller.deleteProduct);
router.patch('/:id/stock', authenticateToken, authorizeAdmin, controller.updateStock);

router.post('/categories', authenticateToken, authorizeAdmin, controller.createCategory);
router.patch('/categories/:id', authenticateToken, authorizeAdmin, controller.updateCategory);
router.delete('/categories/:id', authenticateToken, authorizeAdmin, controller.deleteCategory);

router.post('/modifiers', authenticateToken, authorizeAdmin, controller.createModifier);

module.exports = router;
