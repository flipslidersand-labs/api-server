import { describe, it, expect, vi } from 'vitest';
import requireRole from '../middleware/roleMiddleware.js';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('requireRole', () => {
  it('calls next() when role matches', () => {
    const mw = requireRole('admin', 'editor');
    const req = { user: { role: 'editor' } };
    const res = makeRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is missing', () => {
    const mw = requireRole('admin');
    const req = {};
    const res = makeRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not in allowed list', () => {
    const mw = requireRole('admin');
    const req = { user: { role: 'viewer' } };
    const res = makeRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admin when multiple roles listed', () => {
    const mw = requireRole('viewer', 'editor', 'admin');
    const req = { user: { role: 'admin' } };
    const res = makeRes();
    const next = vi.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
