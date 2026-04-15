const router = require('express').Router();
const c = require('../controllers/abilityController');

router.get('/', c.list);

module.exports = router;
