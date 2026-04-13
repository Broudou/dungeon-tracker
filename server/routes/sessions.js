const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/sessionController');

// Public: join by key (players don't log in)
router.post('/join/:key', c.join);

// Public: basic session info + campaign player list (used by non-DM session page)
router.get('/:id/lobby', c.lobby);

// Public: basic session data (phase, campaignId — not sensitive)
router.get('/:id', c.get);

// DM-only
router.post('/', auth, c.create);

module.exports = router;
