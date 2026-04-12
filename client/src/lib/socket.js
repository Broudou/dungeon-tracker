import { io } from 'socket.io-client';

let _socket = null;

/**
 * Connect to the server socket.
 *
 * @param {string} sessionId  - MongoDB session _id
 * @param {object} identity   - { token } for DM, or { displayName, characterId } for player
 * @returns {import('socket.io-client').Socket}
 */
export function connectSocket(sessionId, identity = {}) {
  if (_socket) _socket.disconnect();

  _socket = io('/', {
    auth: { sessionId, ...identity },
    transports: ['websocket'],
    withCredentials: true,
  });

  return _socket;
}

export function getSocket() {
  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
