const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/services/engagementService", () => ({
  createEngagement: jest.fn(),
}));

const app = require("../src/app");
const engagementService = require("../src/services/engagementService");

describe("POST /api/engagements authorization", () => {
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

  function createToken(role) {
    return jwt.sign(
      { id: 10, role },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  }

  test("returns 401 when token is missing", async () => {
    const response = await request(app)
      .post("/api/engagements")
      .send({ name: "Test engagement" });

    expect(response.status).toBe(401);
    expect(
      engagementService.createEngagement
    ).not.toHaveBeenCalled();
  });

  test("returns 401 when token is invalid", async () => {
    const response = await request(app)
      .post("/api/engagements")
      .set("Authorization", "Bearer invalid-token")
      .send({ name: "Test engagement" });

    expect(response.status).toBe(401);
    expect(
      engagementService.createEngagement
    ).not.toHaveBeenCalled();
  });

  test("returns 403 for TEAM_MEMBER", async () => {
    const token = createToken("TEAM_MEMBER");

    const response = await request(app)
      .post("/api/engagements")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test engagement" });

    expect(response.status).toBe(403);
    expect(
      engagementService.createEngagement
    ).not.toHaveBeenCalled();
  });

  test.each(["MANAGER", "ADMIN"])(
    "allows %s to create an engagement",
    async (role) => {
      const token = createToken(role);

      engagementService.createEngagement.mockResolvedValueOnce({
        id: 100,
        name: "Test engagement",
      });

      const response = await request(app)
        .post("/api/engagements")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Test engagement" });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(
        engagementService.createEngagement
      ).toHaveBeenCalledTimes(1);
    }
  );
});