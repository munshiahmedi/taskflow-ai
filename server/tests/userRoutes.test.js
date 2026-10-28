const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
}));

const app = require("../src/app");
const pool = require("../src/config/db");

describe("GET /api/users/team-members", () => {
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

  function authorized(role) {
    const token = jwt.sign(
      { id: 10, role },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    return `Bearer ${token}`;
  }

  test("requires authentication", async () => {
    const response = await request(app).get("/api/users/team-members");

    expect(response.status).toBe(401);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("allows ADMIN and MANAGER while denying TEAM_MEMBER", async () => {
    for (const role of ["ADMIN", "MANAGER"]) {
      pool.execute.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .get("/api/users/team-members")
        .set("Authorization", authorized(role));

      expect(response.status).toBe(200);
    }

    const deniedResponse = await request(app)
      .get("/api/users/team-members")
      .set("Authorization", authorized("TEAM_MEMBER"));

    expect(deniedResponse.status).toBe(403);
    expect(pool.execute).toHaveBeenCalledTimes(2);
  });

  test("returns only safe fields for active team members", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 7,
          fullName: "Team Member",
          email: "member@example.com",
          password_hash: "should-not-be-returned",
          role: "TEAM_MEMBER",
          is_active: 1,
        },
      ],
    ]);

    const response = await request(app)
      .get("/api/users/team-members")
      .set("Authorization", authorized("MANAGER"));

    expect(response.status).toBe(200);
    expect(response.body.members).toEqual([
      {
        id: 7,
        fullName: "Team Member",
        email: "member@example.com",
      },
    ]);
    expect(JSON.stringify(response.body)).not.toContain("password_hash");

    const [query] = pool.execute.mock.calls[0];
    expect(query).toMatch(/SELECT id, full_name AS fullName, email/i);
    expect(query).toMatch(/role = 'TEAM_MEMBER'/);
    expect(query).toMatch(/is_active = 1/);
    expect(query).not.toMatch(/password/i);
  });
});
