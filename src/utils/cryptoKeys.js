import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function generateRSAKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return {
    publicKey,
    privateKey
  };
}

export function loadKeysFromEnv() {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required');
  }

  return {
    privateKey,
    publicKey
  };
}

export function getPublicKeyJWKS(publicKey) {
  // Convert PEM public key to JWK for JWKS endpoint
  // This is a simplified version; in production you might use a library like 'pem-to-jwk'
  const keyDetails = crypto.createPublicKey({
    key: publicKey,
    format: 'pem'
  }).asymmetricKeyDetails;

  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    n: keyDetails.n.toString('base64url'),
    e: keyDetails.e.toString('base64url'),
    kid: 'api-server-jwt-key'
  };
}
