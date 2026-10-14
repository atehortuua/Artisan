const router = require('express').Router();
const controller = require('../controllers/orders.controllers');

router.post('/', controller.createOrder);
router.post('/items', controller.addItemToOrder);
router.get('/:id', controller.getOrderById);
router.patch('/:id/discount', controller.applyDiscount);
router.patch('/:id/cancel', controller.cancelOrder);

module.exports = router;
