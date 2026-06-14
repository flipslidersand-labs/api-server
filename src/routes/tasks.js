import express from 'express';
import taskController from '../controllers/taskController.js';
import authMiddleware from '../middleware/auth.middleware.js';
import requireRole from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, requireRole('viewer', 'editor', 'admin'), taskController.getTasks.bind(taskController));
router.get('/:task_id', authMiddleware, requireRole('viewer', 'editor', 'admin'), taskController.getTask.bind(taskController));
router.post('/', authMiddleware, requireRole('editor', 'admin'), taskController.createTask.bind(taskController));
router.put('/:task_id', authMiddleware, requireRole('editor', 'admin'), taskController.updateTask.bind(taskController));
router.patch('/:task_id/status', authMiddleware, requireRole('editor', 'admin'), taskController.updateTaskStatus.bind(taskController));
router.delete('/:task_id', authMiddleware, requireRole('admin'), taskController.deleteTask.bind(taskController));

export default router;
