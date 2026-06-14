import { describe, it, expect } from 'vitest';
import APIResponse from '../utils/response.js';

describe('APIResponse', () => {
  describe('success', () => {
    it('wraps data with success=true', () => {
      const r = APIResponse.success({ id: 1 });
      expect(r.success).toBe(true);
      expect(r.data).toEqual({ id: 1 });
      expect(r.error).toBeNull();
      expect(r.meta.timestamp).toBeDefined();
    });

    it('merges extra meta fields', () => {
      const r = APIResponse.success({}, { foo: 'bar' });
      expect(r.meta.foo).toBe('bar');
    });
  });

  describe('error', () => {
    it('wraps error with success=false', () => {
      const r = APIResponse.error('NOT_FOUND', 'Missing');
      expect(r.success).toBe(false);
      expect(r.data).toBeNull();
      expect(r.error.code).toBe('NOT_FOUND');
      expect(r.error.message).toBe('Missing');
    });
  });

  describe('paginated', () => {
    it('calculates page and total_pages', () => {
      const r = APIResponse.paginated([1, 2, 3], 30, 10, 10);
      expect(r.success).toBe(true);
      expect(r.data).toEqual([1, 2, 3]);
      expect(r.meta.pagination.total_count).toBe(30);
      expect(r.meta.pagination.page).toBe(2);
      expect(r.meta.pagination.total_pages).toBe(3);
    });

    it('handles zero total', () => {
      const r = APIResponse.paginated([], 0, 10, 0);
      expect(r.meta.pagination.total_pages).toBe(0);
      expect(r.meta.pagination.page).toBe(1);
    });
  });
});
