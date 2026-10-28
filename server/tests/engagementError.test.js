const request = require("supertest");

jest.mock("../src/services/engagementService", () => ({
  createEngagement: jest.fn(),
}));

const app = require("../src/app");
const engagementService = require("../src/services/engagementService");
const jwt = require("jsonwebtoken");

describe("POST /api/engagements error handling", () => {
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

  function createToken() {
    return jwt.sign(
      { id: 10, role: "MANAGER" },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  }

  test("returns 400 for a validation error", async () => {
    engagementService.createEngagement.mockRejectedValueOnce(
      Object.assign(
        new Error("Valid engagement input is required"),
        { statusCode: 400 }
      )
    );

    const response = await request(app)
      .post("/api/engagements")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Valid engagement input is required",
    });
  });

  test("returns 409 for a duplicate engagement", async () => {
    engagementService.createEngagement.mockRejectedValueOnce(
      Object.assign(
        new Error(
          "A recurring engagement already exists for this client, service and period"
        ),
        { statusCode: 409 }
      )
    );

    const response = await request(app)
      .post("/api/engagements")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ name: "Monthly engagement" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message:
        "A recurring engagement already exists for this client, service and period",
    });
  });

  test("returns a generic 500 for an unexpected error", async () => {
    engagementService.createEngagement.mockRejectedValueOnce(
      new Error("Sensitive database details")
    );

    const response = await request(app)
      .post("/api/engagements")
      .set("Authorization", `Bearer ${createToken()}`)
      .send({ name: "Monthly engagement" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
    });
    expect(response.body.message).not.toContain(
      "Sensitive database details"
    );
  });
});