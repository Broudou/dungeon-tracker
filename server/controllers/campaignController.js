const Campaign = require('../models/Campaign');

// ── helpers ──────────────────────────────────────────────────────────────────

async function ownedCampaign(id, userId) {
  const campaign = await Campaign.findOne({ _id: id, dmId: userId });
  return campaign; // null if not found or not owned
}

// ── campaigns ─────────────────────────────────────────────────────────────────

exports.list = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ dmId: req.user._id })
      .select('name description players lore createdAt')
      .sort('-createdAt');
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const campaign = await Campaign.create({ dmId: req.user._id, name, description });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, description } = req.body;
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, dmId: req.user._id },
      { $set: { name, description } },
      { new: true, runValidators: true }
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── players ───────────────────────────────────────────────────────────────────

exports.addPlayer = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    campaign.players.push(req.body);
    await campaign.save();
    res.status(201).json(campaign.players[campaign.players.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const player = campaign.players.id(req.params.playerId);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    // Merge top-level and nested fields cleanly
    Object.assign(player, req.body);
    await campaign.save();
    res.json(player);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePlayer = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const player = campaign.players.id(req.params.playerId);
    if (!player) return res.status(404).json({ message: 'Player not found' });

    player.deleteOne();
    await campaign.save();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── lore ──────────────────────────────────────────────────────────────────────

exports.getLore = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign.lore);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addLore = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    campaign.lore.push(req.body);
    await campaign.save();
    res.status(201).json(campaign.lore[campaign.lore.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateLore = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const entry = campaign.lore.id(req.params.entryId);
    if (!entry) return res.status(404).json({ message: 'Lore entry not found' });

    Object.assign(entry, req.body);
    await campaign.save();
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteLore = async (req, res) => {
  try {
    const campaign = await ownedCampaign(req.params.id, req.user._id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const entry = campaign.lore.id(req.params.entryId);
    if (!entry) return res.status(404).json({ message: 'Lore entry not found' });

    entry.deleteOne();
    await campaign.save();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
