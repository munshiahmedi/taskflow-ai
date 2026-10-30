const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
  getConnection: jest.fn(),
}));

const app = require("../src/app");
const pool = require("../src/config/db");
const connection = {
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

describe("GET /api/users/team-members", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET =
      originalJwtSecret || "test-only-secret";
  });

  describe("ADMIN user management routes", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      pool.getConnection.mockResolvedValue(connection);
      connection.execute.mockReset();
      connection.beginTransaction.mockReset();
      connection.commit.mockReset();
      connection.rollback.mockReset();
      connection.release.mockReset();
      connection.beginTransaction.mockResolvedValue(undefined);
      connection.commit.mockResolvedValue(undefined);
      connection.rollback.mockResolvedValue(undefined);
      connection.release.mockReturnValue(undefined);
    });

    function authorized(role, id = 10) {
      const token = jwt.sign(
        { id, role },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }
      );

      return `Bearer ${token}`;
    }

    const adminOnlyEndpoints = [
      ["get", "/api/users", null],
      ["post", "/api/users", {}],
      ["put", "/api/users/8", {}],
      ["patch", "/api/users/8/role", {}],
      ["patch", "/api/users/8/status", {}],
    ];

    test.each(adminOnlyEndpoints)(
      "requires authentication for %s %s",
      async (method, path, body) => {
        let route = request(app)[method](path);
        if (body) route = route.send(body);

        const response = await route;

        expect(response.status).toBe(401);
        expect(pool.execute).not.toHaveBeenCalled();
      }
    );

    test.each(["MANAGER", "TEAM_MEMBER"])(
      "denies %s access to every Admin-only users endpoint",
      async (role) => {
        for (const [method, path, body] of adminOnlyEndpoints) {
          let route = request(app)[method](path).set(
            "Authorization",
            authorized(role)
          );
          if (body) route = route.send(body);

          const response = await route;

          expect(response.status).toBe(403);
        }

        expect(pool.execute).not.toHaveBeenCalled();
      }
    );

    test.each(["MANAGER", "TEAM_MEMBER"])(
      "denies %s access to the full user list",
      async (role) => {
        const unauthorized = await request(app)
          .get("/api/users")
          .set("Authorization", authorized(role));

        expect(unauthorized.status).toBe(403);
        expect(pool.execute).not.toHaveBeenCalled();
      }
    );

    test("returns safe profile fields to an ADMIN", async () => {
      pool.execute.mockResolvedValueOnce([[
        {
          id: 8,
          fullName: "Team Member",
          email: "member@example.com",
          role: "TEAM_MEMBER",
          isActive: true,
          password_hash: "must-not-be-returned",
        },
      ]]);

      const response = await request(app)
        .get("/api/users")
        .set("Authorization", authorized("ADMIN"));

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([
        {
          id: 8,
          fullName: "Team Member",
          email: "member@example.com",
          role: "TEAM_MEMBER",
          isActive: true,
        },
      ]);
      expect(JSON.stringify(response.body)).not.toContain("password");
    });

    test("allows ADMIN to create a Manager with a password hash", async () => {
      pool.execute
        .mockResolvedValueOnce([{ insertId: 8 }])
        .mockResolvedValueOnce([[
          {
            id: 8,
            fullName: "New Manager",
            email: "manager@example.com",
            role: "MANAGER",
            isActive: 1,
          },
        ]]);

      const response = await request(app)
        .post("/api/users")
        .set("Authorization", authorized("ADMIN"))
        .send({
          fullName: "New Manager",
          email: "MANAGER@example.com",
          password: "SecurePassword123",
          role: "MANAGER",
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toEqual({
        id: 8,
        fullName: "New Manager",
        email: "manager@example.com",
        role: "MANAGER",
        isActive: true,
      });
      expect(JSON.stringify(response.body)).not.toContain("password");
      const [query, values] = pool.execute.mock.calls[0];
      expect(query).toContain("password_hash");
      expect(values).toEqual([
        "New Manager",
        "manager@example.com",
        expect.any(String),
        "MANAGER",
      ]);
      expect(values[2]).not.toBe("SecurePassword123");
    });

    test("allows ADMIN to promote an existing user", async () => {
      connection.execute
        .mockResolvedValueOnce([[{ acquired: 1 }]])
        .mockResolvedValueOnce([[
          {
            id: 8,
            fullName: "Team Member",
            email: "member@example.com",
            role: "TEAM_MEMBER",
            isActive: 1,
          },
        ]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([{}]);

      const response = await request(app)
        .patch("/api/users/8/role")
        .set("Authorization", authorized("ADMIN"))
        .send({ role: "MANAGER" });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 8,
        role: "MANAGER",
      });
      expect(connection.execute).toHaveBeenCalledWith(
        "UPDATE users SET role = ? WHERE id = ?",
        ["MANAGER", 8]
      );
    });

    test.each(["MANAGER", "TEAM_MEMBER"])(
      "denies %s from creating a Manager account",
      async (role) => {
        const response = await request(app)
          .post("/api/users")
          .set("Authorization", authorized(role))
          .send({
            fullName: "New Manager",
            email: "manager@example.com",
            password: "SecurePassword123",
            role: "MANAGER",
          });

        expect(response.status).toBe(403);
        expect(pool.execute).not.toHaveBeenCalled();
      }
    );

    test("refuses creating another Admin and validates required fields", async () => {
      const adminCreation = await request(app)
        .post("/api/users")
        .set("Authorization", authorized("ADMIN"))
        .send({
          fullName: "Second Admin",
          email: "second@example.com",
          password: "SecurePassword123",
          role: "ADMIN",
        });

      expect(adminCreation.status).toBe(400);

      const missingPassword = await request(app)
        .post("/api/users")
        .set("Authorization", authorized("ADMIN"))
        .send({
          fullName: "Manager",
          email: "manager@example.com",
          role: "MANAGER",
        });

      expect(missingPassword.status).toBe(400);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test("prevents removing the last active Admin", async () => {
      connection.execute
        .mockResolvedValueOnce([[{ acquired: 1 }]])
        .mockResolvedValueOnce([[
          {
            id: 10,
            fullName: "Admin",
            email: "admin@example.com",
            role: "ADMIN",
            isActive: 1,
          },
        ]])
        .mockResolvedValueOnce([[{ id: 10 }]])
        .mockResolvedValueOnce([{}]);

      const demoteResponse = await request(app)
        .patch("/api/users/10/role")
        .set("Authorization", authorized("ADMIN"))
        .send({ role: "MANAGER" });

      expect(demoteResponse.status).toBe(409);
      expect(demoteResponse.body.message).toMatch(/last active administrator/i);
      expect(connection.execute).not.toHaveBeenCalledWith(
        "UPDATE users SET role = ? WHERE id = ?",
        expect.anything()
      );
    });

    test("prevents deactivating the last active Admin", async () => {
      connection.execute
        .mockResolvedValueOnce([[{ acquired: 1 }]])
        .mockResolvedValueOnce([[
          {
            id: 10,
            fullName: "Admin",
            email: "admin@example.com",
            role: "ADMIN",
            isActive: 1,
          },
        ]])
        .mockResolvedValueOnce([[{ id: 10 }]])
        .mockResolvedValueOnce([{}]);

      const response = await request(app)
        .patch("/api/users/10/status")
        .set("Authorization", authorized("ADMIN"))
        .send({ isActive: false });

      expect(response.status).toBe(409);
      expect(connection.execute).not.toHaveBeenCalledWith(
        "UPDATE users SET is_active = ? WHERE id = ?",
        expect.anything()
      );
    });

    test("rejects invalid roles and allows an unchanged own role", async () => {
      const invalidRole = await request(app)
        .patch("/api/users/8/role")
        .set("Authorization", authorized("ADMIN"))
        .send({ role: "OWNER" });

      expect(invalidRole.status).toBe(400);

      connection.execute
        .mockResolvedValueOnce([[{ acquired: 1 }]])
        .mockResolvedValueOnce([[
          {
            id: 10,
            fullName: "Admin",
            email: "admin@example.com",
            role: "ADMIN",
            isActive: 1,
          },
        ]])
        .mockResolvedValueOnce([{}]);

      const selfPromotion = await request(app)
        .patch("/api/users/10/role")
        .set("Authorization", authorized("ADMIN"))
        .send({ role: "ADMIN" });

      expect(selfPromotion.status).toBe(200);
    });

    test("does not allow unauthenticated role updates", async () => {
      const response = await request(app)
        .patch("/api/users/8/role")
        .send({ role: "MANAGER" });

      expect(response.status).toBe(401);
      expect(pool.execute).not.toHaveBeenCalled();
    });
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
