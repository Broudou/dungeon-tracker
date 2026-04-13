const Spell = require('../models/Spell');

exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.name) filter.name = { $regex: req.query.name, $options: 'i' };
    if (req.query.level !== undefined) filter.level = Number(req.query.level);
    if (req.query.school) filter.school = { $regex: req.query.school, $options: 'i' };
    if (req.query.class) filter.classes = { $regex: req.query.class, $options: 'i' };

    const spells = await Spell.find(filter)
      .sort({ level: 1, name: 1 })
      .limit(500);
    res.json(spells);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const spell = await Spell.findById(req.params.id);
    if (!spell) return res.status(404).json({ message: 'Spell not found' });
    res.json(spell);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
