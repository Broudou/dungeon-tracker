/**
 * Session phase socket handlers.
 */

function registerWorldHandlers(io, socket, room, session) {

  // Phase switch (DM only)
  socket.on('session:setPhase', async ({ phase }) => {
    if (!socket.isDM) return;
    try {
      if (!['open-world', 'combat'].includes(phase)) return;
      session.phase = phase;
      await session.save();
      io.to(room).emit('session:phase', phase);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });
}

module.exports = { registerWorldHandlers };
