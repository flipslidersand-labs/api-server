import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import jwt from "jsonwebtoken";

// vi.hoisted ensures these are initialized before vi.mock factory runs
const { mockAuth, mockFrom } = vi.hoisted(() => ({
  mockAuth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
  mockFrom: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: mockAuth,
    from: mockFrom,
  })),
}));

// Force HS256 path by ensuring RS256 keys are absent
vi.mock("../utils/cryptoKeys.js", () => ({
  loadKeysFromEnv: vi.fn(() => {
    throw new Error("no keys");
  }),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  // Unset Supabase so the service uses dev-fallback paths for login
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_KEY;
});

// Import AFTER mocks are in place
import authService from "../services/authService.js";

function mockChain(returnValue) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.single.mockResolvedValue(returnValue);
  return chain;
}

describe("AuthService (HS256 / dev-fallback mode)", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("login", () => {
    it("throws VALIDATION_ERROR when email or password is missing", async () => {
      await expect(authService.login("", "")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("throws INVALID_CREDENTIALS when user is not found in dev mode", async () => {
      const chain = mockChain({ data: null, error: { message: "not found" } });
      mockFrom.mockReturnValue(chain);
      await expect(
        authService.login("ghost@x.com", "pw"),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    });

    it("returns tokens when user is found in dev mode", async () => {
      const user = {
        id: "u1",
        name: "Alice",
        email: "alice@x.com",
        role: "admin",
      };
      const chain = mockChain({ data: user, error: null });
      mockFrom.mockReturnValue(chain);
      const result = await authService.login("alice@x.com", "any");
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result.user.role).toBe("admin");
    });
  });

  describe("register", () => {
    it("throws VALIDATION_ERROR when fields are missing", async () => {
      await expect(
        authService.register("", "pw", "name"),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("throws VALIDATION_ERROR when password is too short", async () => {
      await expect(
        authService.register("a@b.com", "short", "Alice"),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("throws SERVICE_UNAVAILABLE when Supabase not configured", async () => {
      // SUPABASE_URL is not set → supabaseConfigured = false
      await expect(
        authService.register("a@b.com", "longpassword", "Alice"),
      ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    });
  });

  describe("refreshToken", () => {
    it("throws INVALID_TOKEN for a bad token", async () => {
      await expect(authService.refreshToken("bad.token")).rejects.toMatchObject(
        { code: "INVALID_TOKEN" },
      );
    });

    it("returns new access_token when refresh token is valid and user exists", async () => {
      const token = jwt.sign({ user_id: "u1" }, "test-refresh-secret");
      const chain = mockChain({
        data: { role: "viewer", email: "alice@x.com" },
        error: null,
      });
      mockFrom.mockReturnValue(chain);
      const result = await authService.refreshToken(token);
      expect(result).toHaveProperty("access_token");
      expect(result.token_type).toBe("Bearer");
      expect(result.expires_in).toBe(900);
    });

    it("throws INVALID_TOKEN when user not found after valid decode", async () => {
      const token = jwt.sign({ user_id: "u-missing" }, "test-refresh-secret");
      const chain = mockChain({ data: null, error: { message: "no row" } });
      mockFrom.mockReturnValue(chain);
      await expect(authService.refreshToken(token)).rejects.toMatchObject({
        code: "INVALID_TOKEN",
      });
    });
  });

  describe("getMe", () => {
    it("throws NOT_FOUND when user is missing", async () => {
      const chain = mockChain({ data: null, error: { message: "no row" } });
      mockFrom.mockReturnValue(chain);
      await expect(authService.getMe("u-missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("returns user data when found", async () => {
      const user = {
        id: "u1",
        name: "Alice",
        email: "a@x.com",
        role: "viewer",
        created_at: "2026-01-01",
      };
      const chain = mockChain({ data: user, error: null });
      mockFrom.mockReturnValue(chain);
      const result = await authService.getMe("u1");
      expect(result).toMatchObject({ id: "u1", role: "viewer" });
    });
  });
});
