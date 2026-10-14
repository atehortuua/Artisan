const router = require('express').Router();
const controller = require('../controllers/cuentas.controller');

router.post('/split', controller.splitAccount);
router.get('/:orden_id', controller.getSplitAccounts);
router.post('/pay-fraction', controller.payFraction);

module.exports = router;
