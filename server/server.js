require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { initSocket } = require('./socket/index');

const app    = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      CLIENT_ORIGIN,
    credentials: true,
  },
});
initSocket(io);

// ── Express middleware ────────────────────────────────────────────────────────
connectDB();

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/campaigns',       require('./routes/campaigns'));
app.use('/api/sessions',        require('./routes/sessions'));
app.use('/api/monsters',        require('./routes/monsters'));
app.use('/api/spells',          require('./routes/spells'));
app.use('/api/custom-creatures', require('./routes/customCreatures'));

// ── Serve SvelteKit build in production ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
