const { Server } = require('socket.io');

let ioInstance = null;

/**
 * Initializes Socket.IO with the provided HTTP server.
 * @param {import('http').Server} httpServer
 * @param {Object} [options]
 * @returns {Server}
 */
function initSocket(httpServer, options = {}) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for mobile/local dev
      methods: ['GET', 'POST'],
    },
    ...options,
  });

  ioInstance.on('connection', (socket) => {
    // Structured log on socket connection
    // Avoid leaking sensitive data
    socket.on('disconnect', (reason) => {
      // Clean disconnect
    });
  });

  return ioInstance;
}

/**
 * Returns the current Socket.IO instance.
 * @returns {Server|null}
 */
function getIO() {
  return ioInstance;
}

/**
 * Helper to set/override the io instance (especially for testing with mocks).
 * @param {Server|null} mockIO
 */
function setIO(mockIO) {
  ioInstance = mockIO;
}

/**
 * Emits a "new-lead" event to all connected clients.
 * @param {import('../services/leadStore').Lead} lead
 */
function emitNewLead(lead) {
  if (ioInstance) {
    ioInstance.emit('new-lead', lead);
  }
}

/**
 * Returns the number of currently connected socket clients.
 * @returns {number}
 */
function getConnectedCount() {
  if (!ioInstance || !ioInstance.sockets) return 0;
  return ioInstance.sockets.sockets ? ioInstance.sockets.sockets.size : 0;
}

module.exports = {
  initSocket,
  getIO,
  setIO,
  emitNewLead,
  getConnectedCount,
};
