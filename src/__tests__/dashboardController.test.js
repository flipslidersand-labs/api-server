import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/dashboardService.js', () => ({
  default: {
    getStats: vi.fn(),
  },
}));

import dashboardController from '../controllers/dashboardController.js';
import dashboardService from '../services/dashboardService.js';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const STATS = { total_tasks: 10, completed_tasks: 5, completion_rate: '50.0', average_lead_time_days: 3, tasks_by_status: {} };

describe('DashboardController.getStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns dashboard stats', async () => {
    dashboardService.getStats.mockResolvedValue(STATS);
    const res = makeRes();
    await dashboardController.getStats({}, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: STATS }));
  });

  it('calls next on service error', async () => {
    dashboardService.getStats.mockRejectedValue(new Error('db fail'));
    const next = vi.fn();
    await dashboardController.getStats({}, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
