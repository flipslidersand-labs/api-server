import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/authService.js', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    getMe: vi.fn(),
  },
}));

// authController imports authMiddleware — mock it to avoid RS256 key loading
vi.mock('../middleware/auth.middleware.js', () => ({ default: vi.fn() }));

import authController from '../controllers/authController.js';
import authService from '../services/authService.js';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('AuthController.login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email or password is missing', async () => {
    const res = makeRes();
    await authController.login({ body: { email: '' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('delegates to authService and returns success on valid credentials', async () => {
    authService.login.mockResolvedValue({ access_token: 'tok', user: {} });
    const res = makeRes();
    await authController.login({ body: { email: 'a@b.com', password: 'pass' } }, res, vi.fn());
    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'pass');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns error status from thrown error', async () => {
    authService.login.mockRejectedValue(Object.assign(new Error('bad creds'), { code: 'INVALID_CREDENTIALS', status: 401 }));
    const res = makeRes();
    await authController.login({ body: { email: 'a@b.com', password: 'wrong' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('AuthController.register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls authService.register and returns 201', async () => {
    authService.register.mockResolvedValue({ access_token: 'tok', user: {} });
    const res = makeRes();
    await authController.register({ body: { email: 'x@y.com', password: 'pass1234', name: 'X' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns error status when service throws', async () => {
    authService.register.mockRejectedValue(Object.assign(new Error('taken'), { code: 'REGISTRATION_FAILED', status: 409 }));
    const res = makeRes();
    await authController.register({ body: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('AuthController.refreshToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when refresh_token is missing', async () => {
    const res = makeRes();
    await authController.refreshToken({ body: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns new access_token on valid refresh', async () => {
    authService.refreshToken.mockResolvedValue({ access_token: 'new-tok' });
    const res = makeRes();
    await authController.refreshToken({ body: { refresh_token: 'rt' } }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 401 when refresh token is invalid', async () => {
    authService.refreshToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'INVALID_TOKEN', status: 401 }));
    const res = makeRes();
    await authController.refreshToken({ body: { refresh_token: 'bad' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('AuthController.getMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user data', async () => {
    authService.getMe.mockResolvedValue({ id: 'u1', name: 'Alice', email: 'a@b.com', role: 'admin' });
    const res = makeRes();
    await authController.getMe({ user: { user_id: 'u1' } }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 404 when user not found', async () => {
    authService.getMe.mockRejectedValue(Object.assign(new Error('not found'), { code: 'NOT_FOUND', status: 404 }));
    const res = makeRes();
    await authController.getMe({ user: { user_id: 'unknown' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
