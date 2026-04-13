const Session = require('../models/Session');
const Campaign = require('../models/Campaign');

exports.create = async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ message: 'campaignId is required' });

    const campaign = await Campaign.findOne({ _id: campaignId, dmId: req.user._id });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Ensure no other active session for this campaign
    const existing = await Session.findOne({ campaignId, status: 'active' });
    if (existing) return res.status(409).json({ message: 'An active session already exists', session: existing });

    // Retry on joinKey collision (extremely unlikely with 36^6 = 2.18B possibilities)
    let session;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        session = await Session.create({ campaignId });
        break;
      } catch (err) {
        if (err.code !== 11000) throw err; // 11000 = duplicate key
      }
    }
    if (!session) return res.status(500).json({ message: 'Failed to generate unique join key' });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.join = async (req, res) => {
  try {
    const key = req.params.key.toUpperCase();
    const session = await Session.findOne({ joinKey: key, status: 'active' });
    if (!session) return res.status(404).json({ message: 'Invalid or expired join key' });
    res.json({ sessionId: session._id, campaignId: session.campaignId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
