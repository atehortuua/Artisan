const router = require('express').Router();
const controller = require('../controllers/tables.controller');

router.get('/', controller.getTables);
router.post('/', controller.createTable);
router.patch('/:id/status', controller.updateTableStatus);

module.exports = router;