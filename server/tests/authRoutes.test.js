
const supertest = require("supertest");
const jwt = require("jsonwebtoken");

let requestCount = 0;
const request = (app) => {
  const ipAddress = `192.0.2.${++requestCount}`;

  return {
    get: (path) =>
      supertest(app).get(path).set("X-Forwarded-For", ipAddress),
    post: (path) =>
      supertest(app).post(path).set("X-Forwarded-For", ipAddress),
  };
};

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

  test("rejects a password longer than 72 UTF-8 bytes", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test User",
        email: "test@example.com",
        password: "é".repeat(37),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("72 UTF-8 bytes");
    expect(authService.registerUser).not.toHaveBeenCalled();
  });

  test("returns a conflict for a duplicate email", async () => {
    const duplicateError = Object.assign(
      new Error("Email is already registered"),
      { statusCode: 409 }
    );
    authService.registerUser.mockRejectedValueOnce(duplicateError);

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test User",
        email: "test@example.com",
        password: "Password123",
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "Email is already registered",
    });
  });

  test("registers a valid user and normalizes email", async () => {
    authService.registerUser.mockResolvedValueOnce({
      id: 1,
      fullName: "Test User",
      email: "test@example.com",
      role: "TEAM_MEMBER",
    });

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: " Test User ",
        email: "TEST@example.com",
        password: "Password123",
        accountType: "MANAGER",
        role: "ADMIN",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user).toEqual({
      id: 1,
      fullName: "Test User",
      email: "test@example.com",
      role: "TEAM_MEMBER",
    });
    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(authService.registerUser).toHaveBeenCalledWith({
      fullName: "Test User",
      email: "test@example.com",
      password: "Password123",
    });
  });

  test("does not return a password hash even if the service object has one", async () => {
    authService.registerUser.mockResolvedValueOnce({
      id: 1,
      fullName: "Test User",
      email: "test@example.com",
      role: "TEAM_MEMBER",
      password_hash: "must-not-be-returned",
    });

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test User",
        email: "test@example.com",
        password: "Password123",
      });

    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain("must-not-be-returned");
    expect(response.body.user).toEqual({
      id: 1,
      fullName: "Test User",
      email: "test@example.com",
      role: "TEAM_MEMBER",
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

  test("logs sanitized details for an unexpected login failure", async () => {
    const originalDbUser = process.env.DB_USER;
    const originalDbPassword = process.env.DB_PASSWORD;
    const originalJwtSecret = process.env.JWT_SECRET;
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    const loginError = Object.assign(
      new Error(
        "Database failure: login-password database-password signing-secret"
      ),
      {
        code: "ER_ACCESS_DENIED_ERROR",
        errno: 1045,
        sqlState: "28000",
        sql: "SELECT sensitive query",
      }
    );

    process.env.DB_USER = "database-user";
    process.env.DB_PASSWORD = "database-password";
    process.env.JWT_SECRET = "signing-secret";
    authService.loginUser.mockRejectedValueOnce(loginError);

    try {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Authorization", "Bearer auth-token")
        .send({
          email: "test@example.com",
          password: "login-password",
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe("Internal server error");
      expect(errorLog).toHaveBeenCalledWith(
        "Login failed",
        expect.objectContaining({
          name: "Error",
          message: expect.stringContaining("Database failure"),
          code: "ER_ACCESS_DENIED_ERROR",
          errno: 1045,
          sqlState: "28000",
        })
      );

      const loggedDetails = JSON.stringify(errorLog.mock.calls);
      for (const secret of [
        "login-password",
        "auth-token",
        "database-user",
        "database-password",
        "signing-secret",
        "sensitive query",
      ]) {
        expect(loggedDetails).not.toContain(secret);
      }
    } finally {
      errorLog.mockRestore();
      if (originalDbUser === undefined) {
        delete process.env.DB_USER;
      } else {
        process.env.DB_USER = originalDbUser;
      }
      if (originalDbPassword === undefined) {
        delete process.env.DB_PASSWORD;
      } else {
        process.env.DB_PASSWORD = originalDbPassword;
      }
      if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalJwtSecret;
      }
    }
  });
});
