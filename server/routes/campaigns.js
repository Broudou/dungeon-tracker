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

router.get('/:id/lore', c.getLore);
router.post('/:id/lore', c.addLore);
router.patch('/:id/lore/:entryId', c.updateLore);
router.delete('/:id/lore/:entryId', c.deleteLore);

module.exports = router;
