/**
 * Middleware helper to capture raw body buffer before Express json parsing transforms it.
 * Used with express.json({ verify: rawBodySaver })
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Buffer} buf
 * @param {string} encoding
 */
function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = Buffer.from(buf);
  }
}

module.exports = {
  rawBodySaver,
};
