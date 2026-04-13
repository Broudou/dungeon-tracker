const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/campaignController');

router.use(auth);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.patch('/:id', c.update);

router.post('/:id/players', c.addPlayer);
router.patch('/:id/players/:playerId', c.updatePlayer);
router.delete('/:id/players/:playerId', c.deletePlayer);

module.exports = router;
