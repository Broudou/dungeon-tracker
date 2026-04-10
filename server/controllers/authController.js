const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  get secure() { return process.env.NODE_ENV === 'production'; },
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET(), { expiresIn: '7d' });
}

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const user = await User.create({ email, passwordHash: password, role: 'dm' });
    res.cookie('token', signToken(user._id), COOKIE_OPTS);
    res.status(201).json({ id: user._id, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.cookie('token', signToken(user._id), COOKIE_OPTS);
    res.json({ id: user._id, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged out' });
};

exports.me = (req, res) => {
  res.json({ id: req.user._id, email: req.user.email, role: req.user.role });
};
