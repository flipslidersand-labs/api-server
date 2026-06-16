import { describe, it, expect, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

// cryptoKeys.js is excluded from coverage; mock it so authMiddleware falls back to HS256
vi.mock('../utils/cryptoKeys.js', () => ({
  loadKeysFromEnv: vi.fn(() => { throw new Error('no RS256 keys'); }),
}));

import authMiddleware from '../middleware/auth.middleware.js';

const SECRET = 'test-secret-key';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(token) {
  return { headers: { authorization: token ? `Bearer ${token}` : undefined } };
}

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('authMiddleware (HS256 fallback)', () => {
  it('returns 401 when Authorization header is missing', () => {
    const res = makeRes();
    authMiddleware({ headers: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 401 for an expired/invalid token', () => {
    const res = makeRes();
    authMiddleware(makeReq('bad.token.here'), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next() and sets req.user for a valid token', () => {
    const token = jwt.sign({ user_id: 'u1', role: 'viewer' }, SECRET, { expiresIn: '1m' });
    const req = makeReq(token);
    const next = vi.fn();
    authMiddleware(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ user_id: 'u1', role: 'viewer' });
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ user_id: 'u2' }, SECRET, { expiresIn: '-1s' });
    const res = makeRes();
    authMiddleware(makeReq(token), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
