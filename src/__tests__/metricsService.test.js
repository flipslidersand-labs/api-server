import { describe, it, expect, beforeEach } from "vitest";

// Import the class itself via the singleton export — we test observable behaviour
// without asserting on absolute counts (singleton may accumulate across test runs).
import { metricsService } from "../services/metricsService.js";

describe("MetricsService", () => {
  describe("recordRequest", () => {
    it("increments total on each call", () => {
      const before = metricsService.requests.total;
      metricsService.recordRequest("GET", "/a", 200, 50);
      expect(metricsService.requests.total).toBe(before + 1);
    });

    it("tracks success count for 2xx", () => {
      const before = metricsService.requests.success;
      metricsService.recordRequest("GET", "/ok", 200, 10);
      expect(metricsService.requests.success).toBe(before + 1);
    });

    it("tracks error count for 4xx/5xx", () => {
      const before = metricsService.requests.errors;
      metricsService.recordRequest("GET", "/err", 404, 20);
      expect(metricsService.requests.errors).toBe(before + 1);
    });

    it("creates byEndpoint entry on first call", () => {
      const ep = `/unique-${Date.now()}`;
      metricsService.recordRequest("DELETE", ep, 204, 30);
      expect(metricsService.requests.byEndpoint[ep]).toBeDefined();
      expect(metricsService.requests.byEndpoint[ep].count).toBe(1);
    });

    it("accumulates byEndpoint on repeated calls", () => {
      const ep = `/repeat-${Date.now()}`;
      metricsService.recordRequest("GET", ep, 200, 10);
      metricsService.recordRequest("GET", ep, 200, 20);
      expect(metricsService.requests.byEndpoint[ep].count).toBe(2);
      expect(metricsService.requests.byEndpoint[ep].totalTime).toBe(30);
    });
  });

  describe("recordError", () => {
    it("appends to errorLog", () => {
      const before = metricsService.errorLog.length;
      metricsService.recordError(new Error("boom"), 500, "/crash");
      expect(metricsService.errorLog.length).toBe(before + 1);
    });

    it("stores message, statusCode, endpoint", () => {
      metricsService.recordError(new Error("test-err"), 422, "/validate");
      const last = metricsService.errorLog.at(-1);
      expect(last.message).toBe("test-err");
      expect(last.statusCode).toBe(422);
      expect(last.endpoint).toBe("/validate");
    });

    it("caps errorLog at 100 entries", () => {
      for (let i = 0; i < 110; i++) {
        metricsService.recordError(new Error(`e${i}`), 500, "/bulk");
      }
      expect(metricsService.errorLog.length).toBeLessThanOrEqual(100);
    });
  });

  describe("recordTokenError", () => {
    it("increments tokenErrors", () => {
      const before = metricsService.tokenErrors;
      metricsService.recordTokenError();
      expect(metricsService.tokenErrors).toBe(before + 1);
    });
  });

  describe("getMetrics", () => {
    it("returns required shape", () => {
      // add some data to ensure non-empty responseTimes path
      metricsService.recordRequest("GET", "/shape", 200, 100);
      const m = metricsService.getMetrics();
      expect(m).toHaveProperty("timestamp");
      expect(m).toHaveProperty("uptime");
      expect(m).toHaveProperty("requests");
      expect(m).toHaveProperty("responseTime");
      expect(m).toHaveProperty("errorRate");
      expect(m).toHaveProperty("tokenErrors");
      expect(m).toHaveProperty("topEndpoints");
    });

    it("errorRate is formatted as a percentage string", () => {
      const m = metricsService.getMetrics();
      expect(m.errorRate).toMatch(/%$/);
    });
  });

  describe("getTopEndpoints", () => {
    it("returns at most 5 entries sorted by request count", () => {
      for (let i = 0; i < 8; i++) {
        const ep = `/ep${i}-${Date.now()}`;
        for (let j = 0; j <= i; j++) {
          metricsService.recordRequest("GET", ep, 200, 5);
        }
      }
      const top = metricsService.getTopEndpoints();
      expect(top.length).toBeLessThanOrEqual(5);
      if (top.length >= 2) {
        expect(top[0].requests).toBeGreaterThanOrEqual(top[1].requests);
      }
    });
  });

  describe("getErrorStats", () => {
    it("returns total, byType, recent for default 24h", () => {
      metricsService.recordError(new Error("e"), 500, "/x");
      const stats = metricsService.getErrorStats("24h");
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("byType");
      expect(stats).toHaveProperty("recent");
    });

    it("supports 1h period", () => {
      const stats = metricsService.getErrorStats("1h");
      expect(stats).toHaveProperty("total");
    });
  });

  describe("getHealth", () => {
    it("returns healthy status when db connected", () => {
      const h = metricsService.getHealth(true);
      expect(h.status).toBe("healthy");
      expect(h.database).toBe("connected");
    });

    it("returns degraded status when db disconnected", () => {
      const h = metricsService.getHealth(false);
      expect(h.status).toBe("degraded");
      expect(h.database).toBe("disconnected");
    });

    it("includes memory and request stats", () => {
      const h = metricsService.getHealth(true);
      expect(h.memory).toHaveProperty("heapUsed");
      expect(h.requests).toHaveProperty("errorRate");
    });
  });
});
