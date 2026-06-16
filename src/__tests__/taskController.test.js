import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/taskService.js', () => ({
  default: {
    getTasks: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

import taskController from '../controllers/taskController.js';
import taskService from '../services/taskService.js';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const TASK = { id: 't1', title: 'Fix bug', current_status_id: 1 };

describe('TaskController.getTasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated tasks', async () => {
    taskService.getTasks.mockResolvedValue({ tasks: [TASK], total_count: 1 });
    const res = makeRes();
    await taskController.getTasks({ query: {} }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('passes filter params to service', async () => {
    taskService.getTasks.mockResolvedValue({ tasks: [], total_count: 0 });
    const res = makeRes();
    await taskController.getTasks(
      { query: { status_id: '2', assigned_to: 'u1', q: 'fix', limit: '10', offset: '0' } },
      res,
      vi.fn()
    );
    expect(taskService.getTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_to: 'u1', q: 'fix' })
    );
  });

  it('calls next on service error', async () => {
    taskService.getTasks.mockRejectedValue(new Error('db down'));
    const next = vi.fn();
    await taskController.getTasks({ query: {} }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('TaskController.getTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns task when found', async () => {
    taskService.getTask.mockResolvedValue(TASK);
    const res = makeRes();
    await taskController.getTask({ params: { task_id: 't1' } }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 404 when task is null', async () => {
    taskService.getTask.mockResolvedValue(null);
    const res = makeRes();
    await taskController.getTask({ params: { task_id: 'missing' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('calls next on error', async () => {
    taskService.getTask.mockRejectedValue(new Error('fail'));
    const next = vi.fn();
    await taskController.getTask({ params: { task_id: 't1' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('TaskController.createTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when title is missing', async () => {
    const res = makeRes();
    await taskController.createTask({ body: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates task and returns 201', async () => {
    taskService.createTask.mockResolvedValue(TASK);
    const res = makeRes();
    await taskController.createTask(
      { body: { title: 'Fix bug', description: 'desc', assigned_to: 'u1' } },
      res,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('calls next on error', async () => {
    taskService.createTask.mockRejectedValue(new Error('db'));
    const next = vi.fn();
    await taskController.createTask({ body: { title: 'x' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('TaskController.updateTaskStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when status_id is missing', async () => {
    const res = makeRes();
    await taskController.updateTaskStatus({ body: {}, params: { task_id: 't1' }, user: {} }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates status and returns success', async () => {
    taskService.updateTaskStatus.mockResolvedValue({ success: true });
    const res = makeRes();
    await taskController.updateTaskStatus(
      { body: { status_id: 2 }, params: { task_id: 't1' }, user: { user_id: 'u1' } },
      res,
      vi.fn()
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('TaskController.updateTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates task fields', async () => {
    taskService.updateTask.mockResolvedValue({ ...TASK, title: 'Updated' });
    const res = makeRes();
    await taskController.updateTask(
      { body: { title: 'Updated' }, params: { task_id: 't1' } },
      res,
      vi.fn()
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns error status for 4xx service errors', async () => {
    taskService.updateTask.mockRejectedValue(Object.assign(new Error('no fields'), { code: 'VALIDATION_ERROR', status: 400 }));
    const res = makeRes();
    await taskController.updateTask({ body: {}, params: { task_id: 't1' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls next for 5xx errors', async () => {
    taskService.updateTask.mockRejectedValue(new Error('db'));
    const next = vi.fn();
    await taskController.updateTask({ body: { title: 'x' }, params: { task_id: 't1' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('TaskController.deleteTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes task and returns success', async () => {
    taskService.deleteTask.mockResolvedValue({ success: true });
    const res = makeRes();
    await taskController.deleteTask({ params: { task_id: 't1' } }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('calls next on error', async () => {
    taskService.deleteTask.mockRejectedValue(new Error('fail'));
    const next = vi.fn();
    await taskController.deleteTask({ params: { task_id: 't1' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
