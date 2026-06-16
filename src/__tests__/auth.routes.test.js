import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../controllers/authController.js", () => ({
  default: {
    login: vi.fn((req, res) => res.json({ success: true })),
    register: vi.fn((req, res) => res.status(201).json({ success: true })),
    refreshToken: vi.fn((req, res) => res.json({ success: true })),
    getMe: vi.fn((req, res) => res.json({ success: true })),
  },
}));

vi.mock("../middleware/auth.middleware.js", () => ({
  default: (req, res, next) => next(),
}));

const mockLoadKeys = vi.fn();
const mockGetPublicKeyJWKS = vi.fn();

vi.mock("../utils/cryptoKeys.js", () => ({
  loadKeysFromEnv: (...args) => mockLoadKeys(...args),
  getPublicKeyJWKS: (...args) => mockGetPublicKeyJWKS(...args),
}));

import authRouter from "../routes/auth.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/", authRouter);
  return app;
}

describe("auth routes", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("POST /login", () => {
    it("routes to authController.login", async () => {
      const res = await request(makeApp())
        .post("/login")
        .send({ email: "a@b.com", password: "pw" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /register", () => {
    it("routes to authController.register", async () => {
      const res = await request(makeApp()).post("/register").send({});
      expect(res.status).toBe(201);
    });
  });

  describe("POST /refresh", () => {
    it("routes to authController.refreshToken", async () => {
      const res = await request(makeApp())
        .post("/refresh")
        .send({ refresh_token: "rt" });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /me", () => {
    it("routes to authController.getMe (via authMiddleware)", async () => {
      const res = await request(makeApp()).get("/me");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /.well-known/jwks.json", () => {
    it("returns JWKS when RS256 keys are configured", async () => {
      const fakeJwk = { kty: "RSA", n: "abc", e: "AQAB" };
      mockLoadKeys.mockReturnValue({ publicKey: "pem-key" });
      mockGetPublicKeyJWKS.mockReturnValue(fakeJwk);

      const res = await request(makeApp()).get("/.well-known/jwks.json");
      expect(res.status).toBe(200);
      expect(res.body.keys).toEqual([fakeJwk]);
    });

    it("returns 503 when RS256 keys are not configured", async () => {
      mockLoadKeys.mockImplementation(() => {
        throw new Error("no keys");
      });

      const res = await request(makeApp()).get("/.well-known/jwks.json");
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("RS256_NOT_CONFIGURED");
    });
  });
});
