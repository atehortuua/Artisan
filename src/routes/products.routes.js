const router = require('express').Router();
const controller = require('../controllers/products.controller');

router.get('/', controller.getProducts);
router.post('/', controller.createProduct);
router.get('/categories', controller.getCategories);

module.exports = router;