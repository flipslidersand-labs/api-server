import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import dashboardService from "../services/dashboardService.js";

function mockChain(resolved) {
  const chain = {};
  const methods = ["select", "eq", "order", "single"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (fn) => Promise.resolve(resolved).then(fn);
  return chain;
}

const STATUS_OPEN = { id: 1, name: "Open", sort_order: 1, is_terminal: false };
const STATUS_DONE = { id: 2, name: "Done", sort_order: 2, is_terminal: true };

describe("DashboardService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getStats", () => {
    it("returns correct stats for mixed tasks", async () => {
      const now = new Date();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      const tasks = [
        {
          id: "t1",
          current_status_id: 2,
          task_statuses: { id: 2, is_terminal: true },
          created_at: yesterday.toISOString(),
          closed_at: now.toISOString(),
        },
        {
          id: "t2",
          current_status_id: 1,
          task_statuses: { id: 1, is_terminal: false },
          created_at: null,
          closed_at: null,
        },
      ];
      const statuses = [STATUS_OPEN, STATUS_DONE];

      let call = 0;
      mockFrom.mockImplementation(() => {
        if (call++ === 0)
          return mockChain({ data: tasks, error: null, count: 2 });
        return mockChain({ data: statuses, error: null });
      });

      const result = await dashboardService.getStats();
      expect(result.total_tasks).toBe(2);
      expect(result.completed_tasks).toBe(1);
      expect(result.completion_rate).toBe("50.0");
      expect(Number(result.average_lead_time_days)).toBeCloseTo(1, 0);
      expect(result.tasks_by_status).toMatchObject({ Open: 1, Done: 1 });
    });

    it("returns zero stats when no tasks", async () => {
      let call = 0;
      mockFrom.mockImplementation(() => {
        if (call++ === 0) return mockChain({ data: [], error: null, count: 0 });
        return mockChain({ data: [STATUS_OPEN], error: null });
      });

      const result = await dashboardService.getStats();
      expect(result.total_tasks).toBe(0);
      expect(result.completed_tasks).toBe(0);
      expect(result.completion_rate).toBe(0);
      expect(result.average_lead_time_days).toBe(0);
    });

    it("skips lead time for tasks missing closed_at", async () => {
      const tasks = [
        {
          id: "t1",
          current_status_id: 2,
          task_statuses: { is_terminal: true },
          created_at: "2026-01-01T00:00:00Z",
          closed_at: null,
        },
      ];
      let call = 0;
      mockFrom.mockImplementation(() => {
        if (call++ === 0)
          return mockChain({ data: tasks, error: null, count: 1 });
        return mockChain({ data: [STATUS_DONE], error: null });
      });

      const result = await dashboardService.getStats();
      expect(result.average_lead_time_days).toBe(0);
    });

    it("handles tasks with no task_statuses relation", async () => {
      const tasks = [
        {
          id: "t1",
          current_status_id: 1,
          task_statuses: null,
          created_at: null,
          closed_at: null,
        },
      ];
      let call = 0;
      mockFrom.mockImplementation(() => {
        if (call++ === 0)
          return mockChain({ data: tasks, error: null, count: 1 });
        return mockChain({ data: [STATUS_OPEN], error: null });
      });

      const result = await dashboardService.getStats();
      expect(result.completed_tasks).toBe(0);
    });
  });
});
