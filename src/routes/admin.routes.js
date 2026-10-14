const router = require('express').Router();
const controller = require('../controllers/admin.controller');

router.get('/dashboard', controller.getDashboard);
router.get('/reports/sales', controller.getSalesReport);
router.get('/reports/top-products', controller.getTopProducts);
router.get('/reports/cash-closures', controller.getCashClosuresReport);

module.exports = router;
