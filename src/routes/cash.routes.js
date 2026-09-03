const router = require('express').Router();
const controller = require('../controllers/cash.controller');

router.post('/open', controller.openShift);
router.post('/pay', controller.processPayment);
router.post('/close', controller.closeShift);

module.exports = router;