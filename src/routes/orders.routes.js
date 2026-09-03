const router = require('express').Router();
const controller = require('../controllers/orders.controllers');

router.post('/', controller.createOrder);
router.post('/items', controller.addItemToOrder);
router.get('/:id', controller.getOrderById);

module.exports = router;