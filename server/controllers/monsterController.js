const Monster = require('../models/Monster');

exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.name) filter.name = { $regex: req.query.name, $options: 'i' };
    if (req.query.cr) filter.cr = req.query.cr;
    if (req.query.type) filter.type = { $regex: req.query.type, $options: 'i' };

    const monsters = await Monster.find(filter)
      .select('name cr type size alignment hp AC speed')
      .sort('name')
      .limit(200);
    res.json(monsters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.get = async (req, res) => {
  try {
    const monster = await Monster.findById(req.params.id);
    if (!monster) return res.status(404).json({ message: 'Monster not found' });
    res.json(monster);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
