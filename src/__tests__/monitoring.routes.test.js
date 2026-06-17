import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockMetrics } = vi.hoisted(() => ({
  mockMetrics: {
    getHealth: vi.fn(),
    getMetrics: vi.fn(),
    getErrorStats: vi.fn(),
  },
}));

vi.mock("../services/metricsService.js", () => ({
  metricsService: mockMetrics,
}));

import monitoringRouter from "../routes/monitoring.js";

const METRICS = {
  requests: { total: 100, success: 95, errors: 5 },
  responseTime: { avg: 50, p95: 120, p99: 200 },
  memory: { heapUsed: 80, heapTotal: 256 },
  tokenErrors: 2,
  uptime: 3600,
  errorRate: "5.00%",
  topEndpoints: [
    { endpoint: "GET /api/tasks", requests: 50, errors: 1, avgTime: 45 },
  ],
};
const ERRORS = { total: 5, byType: { 500: 3, 404: 2 }, recent: [] };
const HEALTH = {
  status: "healthy",
  db: { connected: true },
  requests: { total: 100 },
  memory: {},
};

function makeApp() {
  const app = express();
  app.use("/", monitoringRouter);
  return app;
}

describe("monitoring routes", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET /health/detailed", () => {
    it("returns 200 with health data", async () => {
      mockMetrics.getHealth.mockReturnValue(HEALTH);
      const res = await request(makeApp()).get("/health/detailed");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ status: "healthy" });
    });

    it("returns 503 when getHealth throws", async () => {
      mockMetrics.getHealth
        .mockImplementationOnce(() => {
          throw new Error("db error");
        })
        .mockReturnValueOnce({ status: "degraded" });
      const res = await request(makeApp()).get("/health/detailed");
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /metrics", () => {
    it("returns 200 with metrics data", async () => {
      mockMetrics.getMetrics.mockReturnValue(METRICS);
      const res = await request(makeApp()).get("/metrics");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requests.total).toBe(100);
    });

    it("returns 500 when getMetrics throws", async () => {
      mockMetrics.getMetrics.mockImplementation(() => {
        throw new Error("metrics error");
      });
      const res = await request(makeApp()).get("/metrics");
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /errors", () => {
    it("returns 200 with default 24h period", async () => {
      mockMetrics.getErrorStats.mockReturnValue(ERRORS);
      const res = await request(makeApp()).get("/errors");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMetrics.getErrorStats).toHaveBeenCalledWith("24h");
    });

    it("passes custom period from query param", async () => {
      mockMetrics.getErrorStats.mockReturnValue(ERRORS);
      await request(makeApp()).get("/errors?period=1h");
      expect(mockMetrics.getErrorStats).toHaveBeenCalledWith("1h");
    });

    it("returns 500 when getErrorStats throws", async () => {
      mockMetrics.getErrorStats.mockImplementation(() => {
        throw new Error("error");
      });
      const res = await request(makeApp()).get("/errors");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /dashboard", () => {
    it("returns 200 HTML page", async () => {
      mockMetrics.getMetrics.mockReturnValue(METRICS);
      mockMetrics.getErrorStats.mockReturnValue(ERRORS);
      const res = await request(makeApp()).get("/dashboard");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toContain("API Server");
    });

    it("renders recent errors table when errors exist", async () => {
      const errorsWithRecent = {
        ...ERRORS,
        recent: [
          {
            timestamp: Date.now(),
            statusCode: 500,
            message: "fail",
            endpoint: "/api/tasks",
          },
        ],
      };
      mockMetrics.getMetrics.mockReturnValue(METRICS);
      mockMetrics.getErrorStats.mockReturnValue(errorsWithRecent);
      const res = await request(makeApp()).get("/dashboard");
      expect(res.text).toContain("/api/tasks");
    });

    it("shows OFFLINE/degraded when total requests is 0", async () => {
      const zeroMetrics = {
        ...METRICS,
        requests: { total: 0, success: 0, errors: 0 },
      };
      mockMetrics.getMetrics.mockReturnValue(zeroMetrics);
      mockMetrics.getErrorStats.mockReturnValue(ERRORS);
      const res = await request(makeApp()).get("/dashboard");
      expect(res.text).toContain("OFFLINE");
      expect(res.text).toContain("degraded");
    });

    it("applies error CSS class when tokenErrors > 5", async () => {
      const highErrorMetrics = { ...METRICS, tokenErrors: 10 };
      mockMetrics.getMetrics.mockReturnValue(highErrorMetrics);
      mockMetrics.getErrorStats.mockReturnValue(ERRORS);
      const res = await request(makeApp()).get("/dashboard");
      expect(res.text).toContain("error");
    });
  });
});
