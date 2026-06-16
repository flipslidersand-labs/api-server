import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import taskService from '../services/taskService.js';

// Builder that lets each method in a Supabase query chain return itself, ending in the resolved value.
function mockChain(resolved) {
  const chain = {};
  const methods = ['select', 'eq', 'or', 'lte', 'gte', 'order', 'limit', 'range', 'single', 'insert', 'update'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // The "terminal" call resolves with the given value
  chain.single.mockResolvedValue(resolved);
  chain.range.mockResolvedValue(resolved);
  // Default: resolving the chain object itself resolves with the value
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  chain.then = (onfulfilled) => Promise.resolve(resolved).then(onfulfilled);
  return chain;
}

describe('TaskService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getTasks', () => {
    it('returns tasks and total_count', async () => {
      const chain = mockChain({ data: [{ id: 't1', title: 'T' }], error: null, count: 1 });
      mockFrom.mockReturnValue(chain);
      const result = await taskService.getTasks({});
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('total_count');
    });

    it('throws when query returns an error', async () => {
      const chain = mockChain({ data: null, error: new Error('db'), count: 0 });
      mockFrom.mockReturnValue(chain);
      await expect(taskService.getTasks({})).rejects.toThrow();
    });
  });

  describe('getTask', () => {
    it('returns null when task not found', async () => {
      const taskChain = mockChain({ data: null, error: null });
      const eventsChain = mockChain({ data: [], error: null });
      let call = 0;
      mockFrom.mockImplementation(() => call++ === 0 ? taskChain : eventsChain);
      const result = await taskService.getTask('missing');
      expect(result).toBeNull();
    });

    it('returns task with status_history', async () => {
      const task = { id: 't1', title: 'Fix', task_statuses: {} };
      const logs = [{ task_id: 't1', from_status_id: 1, to_status_id: 2 }];
      const taskChain = mockChain({ data: task, error: null });
      const eventsChain = mockChain({ data: logs, error: null });
      let call = 0;
      mockFrom.mockImplementation(() => call++ === 0 ? taskChain : eventsChain);
      const result = await taskService.getTask('t1');
      expect(result.status_history).toEqual(logs);
    });
  });

  describe('createTask', () => {
    it('throws when no default status exists', async () => {
      const statusChain = mockChain({ data: [], error: null });
      mockFrom.mockReturnValue(statusChain);
      await expect(taskService.createTask('Title', 'desc')).rejects.toThrow('No default status found');
    });

    it('creates and returns a task', async () => {
      const newTask = { id: 't2', title: 'New', current_status_id: 1 };
      let call = 0;
      mockFrom.mockImplementation(() => {
        if (call++ === 0) return mockChain({ data: [{ id: 1 }], error: null });
        return mockChain({ data: newTask, error: null });
      });
      const result = await taskService.createTask('New', 'desc', 'u1');
      expect(result).toMatchObject({ title: 'New' });
    });
  });

  describe('updateTaskStatus', () => {
    it('throws when task does not exist', async () => {
      const chain = mockChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      await expect(taskService.updateTaskStatus('no-task', 2)).rejects.toThrow('Task not found');
    });

    it('updates status and logs event', async () => {
      const task = { current_status_id: 1 };
      let call = 0;
      mockFrom.mockImplementation(() => {
        if (call++ === 0) return mockChain({ data: task, error: null });
        return mockChain({ data: null, error: null });
      });
      const result = await taskService.updateTaskStatus('t1', 2, 'u1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateTask', () => {
    it('throws VALIDATION_ERROR when no allowed fields provided', async () => {
      await expect(taskService.updateTask('t1', { unknown_field: 'x' }))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('throws NOT_FOUND when task is not returned after update', async () => {
      const chain = mockChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);
      await expect(taskService.updateTask('t1', { title: 'New title' }))
        .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns updated task', async () => {
      const updated = { id: 't1', title: 'New title', task_statuses: {} };
      const chain = mockChain({ data: updated, error: null });
      mockFrom.mockReturnValue(chain);
      const result = await taskService.updateTask('t1', { title: 'New title' });
      expect(result.title).toBe('New title');
    });
  });

  describe('deleteTask', () => {
    it('soft-deletes and returns success', async () => {
      const chain = mockChain({ error: null });
      mockFrom.mockReturnValue(chain);
      const result = await taskService.deleteTask('t1');
      expect(result).toEqual({ success: true });
    });

    it('throws on supabase error', async () => {
      const chain = mockChain({ error: new Error('fail') });
      mockFrom.mockReturnValue(chain);
      await expect(taskService.deleteTask('t1')).rejects.toThrow();
    });
  });
});
