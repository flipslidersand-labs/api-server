import jwt from 'jsonwebtoken';
import APIResponse from '../utils/response.js';
import { loadKeysFromEnv } from '../utils/cryptoKeys.js';

let keys;
try {
  keys = loadKeysFromEnv();
} catch (err) {
  // RS256 keys not configured, will fall back to HS256
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json(
      APIResponse.error('MISSING_TOKEN', 'Authorization header required')
    );
  }

  try {
    // Verify with appropriate key based on RS256/HS256 configuration
    const decoded = keys
      ? jwt.verify(token, keys.publicKey)
      : jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json(
      APIResponse.error('INVALID_TOKEN', 'Token expired or invalid')
    );
  }
}

export default authMiddleware;
