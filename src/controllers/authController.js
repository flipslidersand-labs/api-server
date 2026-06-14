import authService from '../services/authService.js';
import authMiddleware from '../middleware/auth.middleware.js';
import APIResponse from '../utils/response.js';

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json(APIResponse.error('VALIDATION_ERROR', 'email and password are required'));
      }
      const result = await authService.login(email, password);
      res.json(APIResponse.success(result));
    } catch (err) {
      const status = err.status ?? 401;
      res.status(status).json(APIResponse.error(err.code ?? 'UNAUTHORIZED', err.message));
    }
  }

  async register(req, res, next) {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register(email, password, name);
      res.status(201).json(APIResponse.success(result));
    } catch (err) {
      const status = err.status ?? 400;
      res.status(status).json(APIResponse.error(err.code ?? 'REGISTRATION_FAILED', err.message));
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json(APIResponse.error('VALIDATION_ERROR', 'refresh_token is required'));
      }
      const result = await authService.refreshToken(refresh_token);
      res.json(APIResponse.success(result));
    } catch (err) {
      const status = err.status ?? 401;
      res.status(status).json(APIResponse.error(err.code ?? 'INVALID_TOKEN', err.message));
    }
  }

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe(req.user.user_id);
      res.json(APIResponse.success(user));
    } catch (err) {
      const status = err.status ?? 404;
      res.status(status).json(APIResponse.error(err.code ?? 'NOT_FOUND', err.message));
    }
  }
}

export default new AuthController();
