import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import requestLogger from '../middleware/requestLogger.js';

describe('requestLogger', () => {
  it('calls next() immediately', () => {
    const req = { method: 'GET', path: '/test' };
    const res = new EventEmitter();
    res.statusCode = 200;
    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('logs method, path and status on finish', () => {
    const req = { method: 'POST', path: '/api/tasks' };
    const res = new EventEmitter();
    res.statusCode = 201;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    requestLogger(req, res, vi.fn());
    res.emit('finish');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('POST'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/api/tasks'));
    consoleSpy.mockRestore();
  });
});
