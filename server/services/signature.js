const crypto = require('crypto');

/**
 * Calculates HMAC-SHA256 signature for raw body using app secret.
 * @param {Buffer|string} rawBody - Raw unparsed body buffer or string
 * @param {string} secret - Meta App Secret
 * @returns {string} Hex-encoded HMAC-SHA256 signature
 */
function calculateSignature(rawBody, secret) {
  if (!secret) {
    throw new Error('App secret is required to compute HMAC signature.');
  }
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf-8');
  return crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
}

/**
 * Verifies the x-hub-signature-256 header against the raw body and app secret.
 * @param {Buffer|string} rawBody - Raw unparsed body
 * @param {string} secret - Meta App Secret
 * @param {string} signatureHeader - Header value e.g. "sha256=abcdef..."
 * @returns {boolean} True if signature is authentic, false otherwise
 */
function verifySignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !secret) {
    return false;
  }

  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) {
    return false;
  }

  const incomingHash = signatureHeader.slice(prefix.length).trim();
  if (!incomingHash) {
    return false;
  }

  const expectedHash = calculateSignature(rawBody, secret);

  const incomingBuffer = Buffer.from(incomingHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
}

module.exports = {
  calculateSignature,
  verifySignature,
};
