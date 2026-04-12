const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { registerCombatHandlers } = require('./combatHandlers');
const { registerWorldHandlers } = require('./worldHandlers');

/**
 * Attach Socket.IO to the HTTP server.
 * Each live session gets its own room: `session:<sessionId>`
 *
 * Auth strategy:
 *   - DM: sends JWT token in handshake auth → verified here, socket.isDM = true
 *   - Player: sends { displayName, characterId, sessionId } in auth → no JWT needed
 */
function initSocket(io) {
  // Middleware: identify DM vs player on every connection
  io.use(async (socket, next) => {
    const { token, displayName, characterId, sessionId } = socket.handshake.auth || {};

    if (token) {
      // DM path
      try {
        const { userId } = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        const user = await User.findById(userId).select('-passwordHash');
        if (!user) return next(new Error('User not found'));
        socket.isDM  = true;
        socket.user  = user;
        socket.sessionId = sessionId;
        return next();
      } catch {
        return next(new Error('Invalid token'));
      }
    }

    // Player path
    if (displayName && sessionId) {
      socket.isDM        = false;
      socket.displayName = displayName;
      socket.characterId = characterId || null;
      socket.sessionId   = sessionId;
      return next();
    }

    next(new Error('Missing auth'));
  });

  io.on('connection', async (socket) => {
    const sessionId = socket.sessionId;
    const room = `session:${sessionId}`;

    // Validate session exists
    const session = await Session.findById(sessionId);
    if (!session || session.status === 'ended') {
      socket.emit('error', { message: 'Session not found or ended' });
      socket.disconnect();
      return;
    }

    socket.join(room);

    // Announce join to room
    io.to(room).emit('session:roster', await buildRoster(io, room));

    if (socket.isDM) {
      socket.emit('session:role', { role: 'dm' });
    } else {
      socket.emit('session:role', { role: 'player', characterId: socket.characterId });
      io.to(room).emit('session:playerJoined', {
        displayName: socket.displayName,
        characterId: socket.characterId,
      });
    }

    // Replay persisted lore cards so reconnecting clients are caught up
    if (session.pushedLore?.length) {
      socket.emit('world:loreFeed', session.pushedLore);
    }

    // Register domain handlers
    registerCombatHandlers(io, socket, room, session);
    registerWorldHandlers(io, socket, room, session);

    socket.on('disconnect', () => {
      io.to(room).emit('session:roster', buildRosterSync(io, room));
    });
  });
}

// Build a list of connected identities for the room
async function buildRoster(io, room) {
  const sockets = await io.in(room).fetchSockets();
  return sockets.map(s => ({
    isDM: s.isDM,
    displayName: s.isDM ? 'Dungeon Master' : s.displayName,
    characterId: s.characterId || null,
  }));
}

function buildRosterSync(io, room) {
  try {
    const sockets = [...(io.sockets.adapter.rooms.get(room) || [])].map(id => io.sockets.sockets.get(id)).filter(Boolean);
    return sockets.map(s => ({
      isDM: s.isDM,
      displayName: s.isDM ? 'Dungeon Master' : s.displayName,
      characterId: s.characterId || null,
    }));
  } catch {
    return [];
  }
}

module.exports = { initSocket };
