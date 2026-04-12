const router = require('express').Router();
const auth   = require('../middleware/auth');
const CustomCreature = require('../models/CustomCreature');
const Campaign = require('../models/Campaign');

// All routes require DM auth

// GET /api/custom-creatures?campaignId=xxx
router.get('/', auth, async (req, res) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) return res.status(400).json({ message: 'campaignId required' });
    // Ensure DM owns this campaign
    const campaign = await Campaign.findOne({ _id: campaignId, dmId: req.user._id });
    if (!campaign) return res.status(403).json({ message: 'Forbidden' });

    const creatures = await CustomCreature.find({ campaignId }).sort({ name: 1 });
    res.json(creatures);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/custom-creatures
router.post('/', auth, async (req, res) => {
  try {
    const { campaignId } = req.body;
    const campaign = await Campaign.findOne({ _id: campaignId, dmId: req.user._id });
    if (!campaign) return res.status(403).json({ message: 'Forbidden' });

    const creature = await CustomCreature.create(req.body);
    res.status(201).json(creature);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/custom-creatures/:id
router.patch('/:id', auth, async (req, res) => {
  try {
    const creature = await CustomCreature.findById(req.params.id);
    if (!creature) return res.status(404).json({ message: 'Not found' });
    const campaign = await Campaign.findOne({ _id: creature.campaignId, dmId: req.user._id });
    if (!campaign) return res.status(403).json({ message: 'Forbidden' });

    Object.assign(creature, req.body);
    await creature.save();
    res.json(creature);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/custom-creatures/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const creature = await CustomCreature.findById(req.params.id);
    if (!creature) return res.status(404).json({ message: 'Not found' });
    const campaign = await Campaign.findOne({ _id: creature.campaignId, dmId: req.user._id });
    if (!campaign) return res.status(403).json({ message: 'Forbidden' });

    await creature.deleteOne();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
