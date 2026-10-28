const router = require('express').Router();
const controller = require('../controllers/cash.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/open', authenticateToken, controller.openShift);
router.post('/pay', authenticateToken, controller.processPayment);
router.post('/close', authenticateToken, controller.closeShift);
router.post('/movement', authenticateToken, controller.registerMovement);
router.get('/active', authenticateToken, controller.getActiveShift);

module.exports = router;
