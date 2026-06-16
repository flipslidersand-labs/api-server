import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/auth.middleware.js", () => ({
  default: (req, res, next) => {
    req.user = { user_id: "u1", role: "admin" };
    next();
  },
}));

vi.mock("../middleware/roleMiddleware.js", () => ({
  default: () => (req, res, next) => next(),
}));

const { mockController } = vi.hoisted(() => ({
  mockController: {
    getTasks: vi.fn((req, res) => res.json({ success: true, data: [] })),
    getTask: vi.fn((req, res) =>
      res.json({ success: true, data: { id: req.params.task_id } }),
    ),
    createTask: vi.fn((req, res) => res.status(201).json({ success: true })),
    updateTask: vi.fn((req, res) => res.json({ success: true })),
    updateTaskStatus: vi.fn((req, res) => res.json({ success: true })),
    deleteTask: vi.fn((req, res) => res.json({ success: true })),
  },
}));

vi.mock("../controllers/taskController.js", () => ({
  default: mockController,
}));

import taskRouter from "../routes/tasks.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/", taskRouter);
  return app;
}

describe("tasks routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET / → getTasks", async () => {
    const res = await request(makeApp()).get("/");
    expect(res.status).toBe(200);
    expect(mockController.getTasks).toHaveBeenCalledOnce();
  });

  it("GET /:task_id → getTask", async () => {
    const res = await request(makeApp()).get("/abc-123");
    expect(res.status).toBe(200);
    expect(mockController.getTask).toHaveBeenCalledOnce();
  });

  it("POST / → createTask", async () => {
    const res = await request(makeApp()).post("/").send({ title: "New task" });
    expect(res.status).toBe(201);
    expect(mockController.createTask).toHaveBeenCalledOnce();
  });

  it("PUT /:task_id → updateTask", async () => {
    const res = await request(makeApp())
      .put("/abc-123")
      .send({ title: "Updated" });
    expect(res.status).toBe(200);
    expect(mockController.updateTask).toHaveBeenCalledOnce();
  });

  it("PATCH /:task_id/status → updateTaskStatus", async () => {
    const res = await request(makeApp())
      .patch("/abc-123/status")
      .send({ status_id: 2 });
    expect(res.status).toBe(200);
    expect(mockController.updateTaskStatus).toHaveBeenCalledOnce();
  });

  it("DELETE /:task_id → deleteTask", async () => {
    const res = await request(makeApp()).delete("/abc-123");
    expect(res.status).toBe(200);
    expect(mockController.deleteTask).toHaveBeenCalledOnce();
  });
});
