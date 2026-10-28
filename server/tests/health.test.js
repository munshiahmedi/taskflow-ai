const request = require("supertest");
const app = require("../src/app");

describe("GET /api/health", () => {
  test("should return 200 and confirm the API is running", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "TaskFlow AI API is running",
    });
  });
});

describe("Unknown API route", () => {
  test("should return 404 for a route that does not exist", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
  });
});
