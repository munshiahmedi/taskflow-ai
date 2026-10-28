
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
  query: jest.fn(),
}));

jest.mock("../src/services/authService", () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn(),
}));

const app = require("../src/app");
const pool = require("../src/config/db");
const authService = require("../src/services/authService");

describe("GET /api/auth/me", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET =
      originalJwtSecret || "test-only-secret";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  function token(overrides = {}, secret = process.env.JWT_SECRET) {
    return jwt.sign(
      { id: 42, role: "MANAGER", ...overrides },
      secret,
      { expiresIn: "5m" }
    );
  }

  test("returns the authenticated user's identity", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 42,
          full_name: "Test Manager",
          email: "manager@example.com",
          role: "MANAGER",
          is_active: 1,
        },
      ],
    ]);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 42,
      fullName: "Test Manager",
      email: "manager@example.com",
      role: "MANAGER",
    });
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [42]
    );
  });

  test.each([
    ["missing", undefined],
    ["invalid", "Bearer invalid-token"],
  ])("rejects a %s token", async (label, authorization) => {
    let requestBuilder = request(app).get("/api/auth/me");

    if (authorization) {
      requestBuilder = requestBuilder.set(
        "Authorization",
        authorization
      );
    }

    const response = await requestBuilder;

    expect(response.status).toBe(401);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("rejects an expired JWT", async () => {
    const expiredToken = jwt.sign(
      { id: 42, role: "MANAGER" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or expired token");
    expect(pool.execute).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects an invalid email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test User",
        email: "invalid-email",
        password: "Password123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(authService.registerUser).not.toHaveBeenCalled();
  });

  test("rejects a password shorter than 8 characters", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test User",
        email: "test@example.com",
        password: "short",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Password");
    expect(authService.registerUser).not.toHaveBeenCalled();
  });

  test("registers a valid user and normalizes email", async () => {
    authService.registerUser.mockResolvedValueOnce({
      id: 1,
      fullName: "Test User",
      email: "test@example.com",
    });

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: " Test User ",
        email: "TEST@example.com",
        password: "Password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(authService.registerUser).toHaveBeenCalledWith({
      fullName: "Test User",
      email: "test@example.com",
      password: "Password123",
    });
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects a missing password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Password is required");
    expect(authService.loginUser).not.toHaveBeenCalled();
  });

  test("rejects an invalid email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "not-an-email",
        password: "Password123",
      });

    expect(response.status).toBe(400);
    expect(authService.loginUser).not.toHaveBeenCalled();
  });

  test("logs in a valid user", async () => {
    authService.loginUser.mockResolvedValueOnce({
      token: "test-jwt-token",
      user: {
        id: 1,
        fullName: "Test User",
        email: "test@example.com",
      },
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "TEST@example.com",
        password: "Password123",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBe("test-jwt-token");
    expect(authService.loginUser).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "Password123",
    });
  });
});
