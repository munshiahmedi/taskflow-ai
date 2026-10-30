const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
}));

const pool = require("../src/config/db");
const { loginUser, registerUser } = require("../src/services/authService");

describe("authentication service registration", () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const testSecret = "auth-service-test-secret";

  beforeAll(() => {
    process.env.JWT_SECRET = testSecret;
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("hashes the password, assigns TEAM_MEMBER, and allows the account to log in", async () => {
    const storedUsers = [];

    pool.execute.mockImplementation(async (query, values = []) => {
      if (query.includes("SELECT id FROM users WHERE email = ?")) {
        const existing = storedUsers.find((user) => user.email === values[0]);
        return [existing ? [{ id: existing.id }] : []];
      }

      if (query.includes("INSERT INTO users")) {
        const [fullName, email, passwordHash] = values;
        const user = {
          id: storedUsers.length + 1,
          full_name: fullName,
          fullName,
          email,
          password_hash: passwordHash,
          role: "TEAM_MEMBER",
          is_active: 1,
        };
        storedUsers.push(user);
        return [{ insertId: user.id }];
      }

      if (query.includes("SELECT id, full_name AS fullName, email, role")) {
        const user = storedUsers.find((stored) => stored.id === values[0]);
        return [[{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        }]];
      }

      if (query.includes("SELECT id, full_name, email, password_hash")) {
        const user = storedUsers.find((stored) => stored.email === values[0]);
        return [user ? [user] : []];
      }

      throw new Error("Unexpected authentication query");
    });

    const registeredUser = await registerUser({
      fullName: "New Team Member",
      email: "new@example.com",
      password: "SecurePassword123",
      accountType: "MANAGER",
      role: "ADMIN",
    });

    expect(registeredUser).toEqual({
      id: 1,
      fullName: "New Team Member",
      email: "new@example.com",
      role: "TEAM_MEMBER",
    });

    const storedUser = storedUsers[0];
    expect(storedUser.password_hash).not.toBe("SecurePassword123");
    await expect(
      bcrypt.compare("SecurePassword123", storedUser.password_hash)
    ).resolves.toBe(true);

    const insertCall = pool.execute.mock.calls.find(([query]) =>
      query.includes("INSERT INTO users")
    );
    expect(insertCall[0]).toContain("'TEAM_MEMBER', 1");
    expect(insertCall[1]).toEqual([
      "New Team Member",
      "new@example.com",
      storedUser.password_hash,
    ]);

    const login = await loginUser({
      email: "new@example.com",
      password: "SecurePassword123",
    });

    expect(login.user).toEqual({
      id: 1,
      fullName: "New Team Member",
      email: "new@example.com",
      role: "TEAM_MEMBER",
    });
    expect(login.user).not.toHaveProperty("password_hash");
    expect(jwt.verify(login.token, testSecret)).toMatchObject({
      id: 1,
      role: "TEAM_MEMBER",
    });
  }, 15000);

  test("rejects an already registered email", async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 8 }]]);

    await expect(
      registerUser({
        fullName: "Existing User",
        email: "existing@example.com",
        password: "SecurePassword123",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Email is already registered",
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute.mock.calls[0][0]).toContain(
      "SELECT id FROM users WHERE email = ?"
    );
  });
});
