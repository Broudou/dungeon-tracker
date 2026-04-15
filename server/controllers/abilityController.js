const Ability = require('../models/Ability');

exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.class) filter.classes = req.query.class;
    if (req.query.type)  filter.type = req.query.type;
    const abilities = await Ability.find(filter).sort({ level: 1, name: 1 });
    res.json(abilities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
