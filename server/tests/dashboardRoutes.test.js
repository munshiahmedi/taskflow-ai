const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
  query: jest.fn(),
}));

const app = require("../src/app");
const pool = require("../src/config/db");

describe("Dashboard API routes", () => {
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

  function token(role = "ADMIN") {
    return jwt.sign(
      { id: 10, role },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  }

  test("rejects a request without a token", async () => {
    const response = await request(app).get("/api/dashboard");

    expect(response.status).toBe(401);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("returns dashboard statistics to an admin", async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        totalTasks: "6",
        notStartedTasks: "1",
        inProgressTasks: "2",
        waitingForClientTasks: "0",
        readyForReviewTasks: "1",
        changesRequestedTasks: "0",
        completedTasks: "2",
        overdueTasks: "1",
      },
    ]]);

    const response = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(200);
    expect(response.body.statistics).toEqual({
      totalTasks: 6,
      notStartedTasks: 1,
      inProgressTasks: 2,
      waitingForClientTasks: 0,
      readyForReviewTasks: 1,
      changesRequestedTasks: 0,
      completedTasks: 2,
      overdueTasks: 1,
    });
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("FROM tasks t"),
      []
    );
  });

  test("limits team member statistics to assigned tasks", async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        totalTasks: 0,
        notStartedTasks: 0,
        inProgressTasks: 0,
        waitingForClientTasks: 0,
        readyForReviewTasks: 0,
        changesRequestedTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
      },
    ]]);

    const response = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`);

    expect(response.status).toBe(200);
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE t.assigned_to = ?"),
      [10]
    );
  });

  test("limits manager statistics to engagements they created", async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        totalTasks: "2",
        notStartedTasks: "1",
        inProgressTasks: "1",
        waitingForClientTasks: "0",
        readyForReviewTasks: "0",
        changesRequestedTasks: "0",
        completedTasks: "0",
        overdueTasks: "0",
      },
    ]]);

    const response = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${token("MANAGER")}`);

    expect(response.status).toBe(200);
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE e.created_by = ?"),
      [10]
    );
  });
});
