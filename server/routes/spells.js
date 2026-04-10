const router = require('express').Router();
const c = require('../controllers/spellController');

router.get('/', c.list);
router.get('/:id', c.get);

module.exports = router;
