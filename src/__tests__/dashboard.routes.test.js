import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/auth.middleware.js", () => ({
  default: (req, res, next) => {
    req.user = { user_id: "u1", role: "viewer" };
    next();
  },
}));

vi.mock("../middleware/roleMiddleware.js", () => ({
  default: () => (req, res, next) => next(),
}));

const { mockDashboardController } = vi.hoisted(() => ({
  mockDashboardController: {
    getStats: vi.fn((req, res) =>
      res.json({
        success: true,
        data: { total_tasks: 10, completed_tasks: 5 },
      }),
    ),
  },
}));

vi.mock("../controllers/dashboardController.js", () => ({
  default: mockDashboardController,
}));

import dashboardRouter from "../routes/dashboard.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/", dashboardRouter);
  return app;
}

describe("dashboard routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /stats → dashboardController.getStats", async () => {
    const res = await request(makeApp()).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDashboardController.getStats).toHaveBeenCalledOnce();
  });
});
