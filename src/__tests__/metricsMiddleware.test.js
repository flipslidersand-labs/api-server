import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/metricsService.js", () => ({
  metricsService: {
    recordRequest: vi.fn(),
    recordTokenError: vi.fn(),
    recordError: vi.fn(),
  },
}));

import { metricsMiddleware } from "../middleware/metricsMiddleware.js";
import { metricsService } from "../services/metricsService.js";

function makeReq(method = "GET", path = "/test") {
  return { method, path };
}

function makeRes(statusCode = 200) {
  const res = {
    statusCode,
    json: vi.fn(),
  };
  // middleware replaces res.json — capture the replacement
  return res;
}

describe("metricsMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next()", () => {
    const next = vi.fn();
    metricsMiddleware(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("records request when res.json is called with 200", () => {
    const req = makeReq("GET", "/api/tasks");
    const res = makeRes(200);
    metricsMiddleware(req, res, vi.fn());
    res.json({ success: true });
    // middleware builds endpoint as `${method} ${path}`
    expect(metricsService.recordRequest).toHaveBeenCalledWith(
      "GET",
      "GET /api/tasks",
      200,
      expect.any(Number),
    );
  });

  it("records token error for 401 response", () => {
    const req = makeReq("GET", "/api/me");
    const res = makeRes(401);
    metricsMiddleware(req, res, vi.fn());
    res.json({ error: { message: "Unauthorized" } });
    expect(metricsService.recordTokenError).toHaveBeenCalled();
  });

  it("records token error for 403 response", () => {
    const req = makeReq("DELETE", "/api/tasks/1");
    const res = makeRes(403);
    metricsMiddleware(req, res, vi.fn());
    res.json({ error: { message: "Forbidden" } });
    expect(metricsService.recordTokenError).toHaveBeenCalled();
  });

  it("records application error for 500 response with error body", () => {
    const req = makeReq("POST", "/api/tasks");
    const res = makeRes(500);
    metricsMiddleware(req, res, vi.fn());
    res.json({ error: { message: "Internal server error" } });
    expect(metricsService.recordError).toHaveBeenCalled();
  });

  it("does not call recordError when error body is absent on 4xx", () => {
    const req = makeReq("GET", "/api/tasks/99");
    const res = makeRes(404);
    metricsMiddleware(req, res, vi.fn());
    res.json({ success: false });
    expect(metricsService.recordError).not.toHaveBeenCalled();
  });
});
