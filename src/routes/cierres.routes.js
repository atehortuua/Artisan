const router = require('express').Router();
const controller = require('../controllers/cierres.controller');

router.post('/', controller.registerClosure);
router.get('/shift/:turno_id', controller.getClosuresByShift);
router.get('/last', controller.getLastClosure);

module.exports = router;
