# RS256 JWT Migration Guide

## Overview

This guide explains how to migrate from HS256 (symmetric) JWT signing to RS256 (asymmetric) signing using RSA key pairs.

### Why RS256?

| Aspect | HS256 | RS256 |
|--------|-------|-------|
| Key Type | Symmetric (single secret) | Asymmetric (public/private pair) |
| Security | Shared secret exposed in requests | Public key exposed, private key secure |
| Scalability | One secret for all services | Public key can be shared freely |
| Best Practice | ✗ Not recommended | ✅ Industry standard |
| Compliance | Limited | Meets OAuth 2.0 / OpenID Connect standards |

## Migration Steps

### Step 1: Generate RSA Key Pair

```bash
cd /home/dev-nodee/projects/ACTIVE/api-server
node scripts/generate-rsa-keys.js
```

This will output your public and private keys in both raw and escaped JSON format.

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# RS256 Keys (copy from generate-rsa-keys.js output)
JWT_PRIVATE_KEY="""
-----BEGIN PRIVATE KEY-----
[your private key content]
-----END PRIVATE KEY-----
"""

JWT_PUBLIC_KEY="""
-----BEGIN PUBLIC KEY-----
[your public key content]
-----END PUBLIC KEY-----
"""
```

For **Render deployment**, set these as secret environment variables in the Render dashboard:
1. Navigate to your API Server service
2. Go to Environment
3. Add `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` as secret variables
4. Deploy

### Step 3: Verify RS256 is Enabled

Once environment variables are set, the API will automatically:
- Sign new JWTs with RS256 (private key)
- Verify tokens using RS256 (public key)
- Expose public key at `GET /api/auth/.well-known/jwks.json`

### Step 4: Fallback Behavior

If RS256 keys are not configured:
- System falls back to HS256 (original behavior)
- Existing HS256 tokens continue to work
- Migration is non-breaking

## Endpoints

### Login (RS256 or HS256)
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com"
}

# Response includes RS256-signed access_token and refresh_token
```

### Refresh Token
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "..."
}

# Returns new RS256-signed access_token
```

### JWKS Endpoint (Client Token Verification)
```bash
GET /api/auth/.well-known/jwks.json

# Response:
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "...",
      "kid": "api-server-jwt-key"
    }
  ]
}
```

Clients can fetch this endpoint to verify JWT signatures independently, without calling the API.

## Client Implementation

### Node.js (using jsonwebtoken)

```javascript
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Fetch public key from JWKS endpoint
const response = await fetch('https://api-server-7e7j.onrender.com/api/auth/.well-known/jwks.json');
const { keys } = await response.json();
const publicKey = keys[0];

// Verify token
try {
  const decoded = jwt.verify(token, publicKey, {
    algorithms: ['RS256']
  });
  console.log('Token valid:', decoded);
} catch (err) {
  console.error('Invalid token:', err.message);
}
```

### Browser (using jwt-decode)

```javascript
import { jwtDecode } from 'jwt-decode';

// Decode (not verify - verification requires server-side verification with public key)
const decoded = jwtDecode(token);
console.log('User:', decoded.email);
console.log('Role:', decoded.role);
```

## Testing

### Generate Test Keys
```bash
node scripts/generate-rsa-keys.js > /tmp/keys.txt
```

### Test Login with RS256
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}' | jq -r '.data.access_token')

echo "Token: $TOKEN"

# Verify it's RS256 (has 3 parts separated by dots)
echo $TOKEN | tr '.' '\n' | head -2
```

### Test Token Refresh
```bash
REFRESH_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}' | jq -r '.data.refresh_token')

curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | jq .
```

### Fetch JWKS
```bash
curl -s http://localhost:3000/api/auth/.well-known/jwks.json | jq .
```

## Implementation Details

### Files Modified

- **src/utils/cryptoKeys.js** (NEW)
  - `generateRSAKeyPair()`: Generates 2048-bit RSA key pair
  - `loadKeysFromEnv()`: Loads keys from environment
  - `getPublicKeyJWKS()`: Converts public key to JWK format

- **src/services/authService.js** (UPDATED)
  - Uses RS256 if keys configured, falls back to HS256
  - Both `login()` and `refreshToken()` updated

- **src/middleware/auth.middleware.js** (UPDATED)
  - Verifies RS256 if keys configured, falls back to HS256
  - Transparent fallback maintains backward compatibility

- **src/routes/auth.js** (UPDATED)
  - New endpoint: `GET /api/auth/.well-known/jwks.json`
  - Provides public key for client-side verification

- **scripts/generate-rsa-keys.js** (NEW)
  - Utility to generate and display key pairs for configuration

## Production Deployment Checklist

- [ ] Generate RSA key pair: `node scripts/generate-rsa-keys.js`
- [ ] Add `JWT_PRIVATE_KEY` to Render environment (as secret)
- [ ] Add `JWT_PUBLIC_KEY` to Render environment (as secret)
- [ ] Deploy changes to Render
- [ ] Verify JWKS endpoint works: `curl https://api-server-7e7j.onrender.com/api/auth/.well-known/jwks.json`
- [ ] Test login returns RS256 token
- [ ] Update client applications to fetch JWKS for token verification (optional but recommended)
- [ ] Monitor logs for any verification failures during transition

## Troubleshooting

### "Token expired or invalid" after migration
**Cause**: Old HS256 tokens won't validate with RS256 public key  
**Solution**: Users need to re-login to get new RS256 tokens

### JWKS endpoint returns 503
**Cause**: RS256 keys not configured  
**Solution**: Set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` environment variables

### "Cannot find module" errors
**Cause**: Missing crypto or fs imports  
**Solution**: Ensure Node.js version is 15.7+, these are built-in modules

## Security Notes

1. **Private Key Security**: The `JWT_PRIVATE_KEY` should be treated as a secret
   - Never commit to version control
   - Only set in secure environment variables
   - Rotate periodically (requires re-issuing tokens)

2. **Public Key Distribution**: The `JWT_PUBLIC_KEY` can be freely shared
   - Publish via JWKS endpoint
   - Clients use it to verify tokens
   - No security risk if exposed

3. **Key Rotation**: To rotate keys in production:
   - Generate new key pair
   - Update environment variables
   - Existing tokens will fail verification
   - Users can continue using old tokens until expiry (7 days for access, 30 days for refresh)

## References

- [JWT.io - RS256 Algorithm](https://jwt.io/)
- [RFC 7518 - JSON Web Algorithms (JWA)](https://tools.ietf.org/html/rfc7518)
- [OpenID Connect Discovery - JWKS](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata)
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html#crypto_crypto_generatekeypairsync_type_options)
