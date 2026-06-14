import taskService from '../services/taskService.js';
import APIResponse from '../utils/response.js';

class TaskController {
  async getTasks(req, res, next) {
    try {
      const { status_id, assigned_to, q, due_before, due_after, limit = 50, offset = 0 } = req.query;
      const lim = Math.min(Math.max(1, parseInt(limit)), 200);
      const off = Math.max(0, parseInt(offset));

      const result = await taskService.getTasks({
        status_id: status_id ? parseInt(status_id) : undefined,
        assigned_to,
        q: q?.trim() || undefined,
        due_before: due_before || undefined,
        due_after: due_after || undefined,
        limit: lim,
        offset: off,
      });

      res.json(APIResponse.paginated(result.tasks, result.total_count, lim, off));
    } catch (err) {
      next(err);
    }
  }

  async getTask(req, res, next) {
    try {
      const task = await taskService.getTask(req.params.task_id);

      if (!task) {
        return res.status(404).json(
          APIResponse.error('NOT_FOUND', 'Task not found')
        );
      }

      res.json(APIResponse.success(task));
    } catch (err) {
      next(err);
    }
  }

  async createTask(req, res, next) {
    try {
      const { title, description, assigned_to } = req.body;

      if (!title) {
        return res.status(400).json(
          APIResponse.error('VALIDATION_ERROR', 'Title is required')
        );
      }

      const task = await taskService.createTask(title, description, assigned_to);

      res.status(201).json(APIResponse.success(task));
    } catch (err) {
      next(err);
    }
  }

  async updateTaskStatus(req, res, next) {
    try {
      const { status_id } = req.body;

      if (!status_id) {
        return res.status(400).json(
          APIResponse.error('VALIDATION_ERROR', 'status_id is required')
        );
      }

      await taskService.updateTaskStatus(
        req.params.task_id,
        status_id,
        req.user?.user_id
      );

      res.json(APIResponse.success({ success: true }));
    } catch (err) {
      next(err);
    }
  }

  async updateTask(req, res, next) {
    try {
      const { title, description, assigned_to, due_date } = req.body;
      const task = await taskService.updateTask(req.params.task_id, { title, description, assigned_to, due_date });
      res.json(APIResponse.success(task));
    } catch (err) {
      const status = err.status ?? 500;
      if (status !== 500) return res.status(status).json(APIResponse.error(err.code, err.message));
      next(err);
    }
  }

  async deleteTask(req, res, next) {
    try {
      await taskService.deleteTask(req.params.task_id);
      res.json(APIResponse.success({ success: true }));
    } catch (err) {
      next(err);
    }
  }
}

export default new TaskController();
