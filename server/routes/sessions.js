const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/sessionController');

// Public: join by key (players don't log in)
router.post('/join/:key', c.join);

// DM-only
router.post('/', auth, c.create);
router.get('/:id', auth, c.get);

module.exports = router;
