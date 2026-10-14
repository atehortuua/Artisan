const router = require('express').Router();
const controller = require('../controllers/proveedores.controller');

router.get('/', controller.getSuppliers);
router.post('/', controller.createSupplier);
router.post('/pay', controller.paySupplier);
router.get('/payments', controller.getSupplierPayments);

module.exports = router;
