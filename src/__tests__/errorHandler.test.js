import { describe, it, expect, vi } from 'vitest';
import errorHandler from '../middleware/errorHandler.js';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('returns 400 for PGRST database errors', () => {
    const err = Object.assign(new Error('db fail'), { code: 'PGRST' });
    const res = makeRes();
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 400 for ValidationError', () => {
    const err = Object.assign(new Error('bad input'), { name: 'ValidationError' });
    const res = makeRes();
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 500 for generic errors', () => {
    const err = new Error('unexpected');
    const res = makeRes();
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
