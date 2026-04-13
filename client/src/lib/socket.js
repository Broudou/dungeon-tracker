import { io } from 'socket.io-client';

let _socket = null;

/**
 * Connect (or reconnect) to the server Socket.IO endpoint.
 * @param {string} sessionId
 * @param {object} identity — { token } for DM, { displayName, characterId } for player
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

export function getSocket() { return _socket; }

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null; }
}
