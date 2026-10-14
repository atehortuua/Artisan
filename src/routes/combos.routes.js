const router = require('express').Router();
const controller = require('../controllers/combos.controller');

router.get('/', controller.getCombos);
router.post('/', controller.createCombo);
router.get('/:id', controller.getComboById);
router.put('/:id', controller.updateCombo);
router.delete('/:id', controller.deleteCombo);

module.exports = router;
