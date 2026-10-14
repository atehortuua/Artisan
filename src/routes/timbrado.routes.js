const router = require('express').Router();
const controller = require('../controllers/timbrado.controller');

router.get('/active', controller.getActiveTimbrado);
router.post('/', controller.createTimbrado);
router.post('/emit', controller.emitInvoice);
router.get('/invoices', controller.getInvoices);
router.post('/invoices/:id/cancel', controller.cancelInvoice);

module.exports = router;
