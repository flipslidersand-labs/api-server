import express from 'express';
import authController from '../controllers/authController.js';
import { loadKeysFromEnv, getPublicKeyJWKS } from '../utils/cryptoKeys.js';

const router = express.Router();

router.post('/login', authController.login.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));

// JWKS endpoint for token verification (RS256)
router.get('/.well-known/jwks.json', (req, res) => {
  try {
    const keys = loadKeysFromEnv();
    const jwk = getPublicKeyJWKS(keys.publicKey);
    res.json({
      keys: [jwk]
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: {
        code: 'RS256_NOT_CONFIGURED',
        message: 'RS256 keys not configured. Using HS256 for JWT signing.'
      }
    });
  }
});

export default router;
