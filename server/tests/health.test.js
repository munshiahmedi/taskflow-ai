const request = require("supertest");
jest.mock("../src/config/db", () => ({
  query: jest.fn(),
  execute: jest.fn(),
  getConnection: jest.fn(),
}));

const app = require("../src/app");
const pool = require("../src/config/db");

afterEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/health", () => {
  test("should return 200 and confirm the API is running", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "TaskFlow AI API is running",
    });
  });

  test("allows requests from the deployed frontend origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://taskflow-ai-frontend-mukm.onrender.com");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://taskflow-ai-frontend-mukm.onrender.com"
    );
  });

  test("does not allow requests from unknown browser origins", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("GET /api/health/db", () => {
  test("returns database name when the connection succeeds", async () => {
    pool.query.mockResolvedValueOnce([
      [{ database_name: "taskflow_ai" }],
    ]);

    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Database connection successful",
      database: "taskflow_ai",
    });
  });

  test("logs safe error code and message but returns a generic failure", async () => {
    const error = Object.assign(new Error("Connection refused"), {
      code: "ECONNREFUSED",
    });
    pool.query.mockRejectedValueOnce(error);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await request(app).get("/api/health/db");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: "Database connection failed",
      });
      expect(response.text).not.toContain(error.message);
      expect(consoleError).toHaveBeenCalledWith(
        "Database health check failed",
        { code: "ECONNREFUSED", message: "Connection refused" }
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("Unknown API route", () => {
  test("should return 404 for a route that does not exist", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
  });
});
