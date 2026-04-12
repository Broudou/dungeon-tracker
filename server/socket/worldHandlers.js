/**
 * World (open-world phase) socket handlers.
 * DM pushes lore cards → players receive them in real time.
 * Players roll skill checks → results broadcast to the room.
 */

function registerWorldHandlers(io, socket, room, session) {

  // DM pushes a lore card to all connected players
  socket.on('world:pushLore', async ({ title, category, content }) => {
    if (!socket.isDM) return;
    try {
      const card = {
        title:    title || 'Untitled',
        category: category || 'Other',
        content:  content || '',
        pushedAt: new Date(),
      };

      session.pushedLore.push(card);
      await session.save();

      io.to(room).emit('world:loreCard', card);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

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
