import express from 'express';
import authController from '../controllers/authController.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { loadKeysFromEnv, getPublicKeyJWKS } from '../utils/cryptoKeys.js';

const router = express.Router();

router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.get('/me', authMiddleware, authController.getMe.bind(authController));

// JWKS endpoint for RS256 public key distribution
router.get('/.well-known/jwks.json', (req, res) => {
  try {
    const keys = loadKeysFromEnv();
    res.json({ keys: [getPublicKeyJWKS(keys.publicKey)] });
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'RS256_NOT_CONFIGURED', message: 'RS256 keys not configured. Using HS256.' },
    });
  }
});

export default router;
