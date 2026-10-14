const router = require('express').Router();
const controller = require('../controllers/products.controller');

router.get('/', controller.getProducts);
router.post('/', controller.createProduct);
router.get('/categories', controller.getCategories);
router.post('/categories', controller.createCategory);
router.patch('/categories/:id', controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);
router.patch('/:id/stock', controller.updateStock);
router.get('/modifiers', controller.getModifiers);
router.post('/modifiers', controller.createModifier);

module.exports = router;
