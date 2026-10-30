jest.mock("../src/config/db", () => ({
  getConnection: jest.fn(),
}));

const pool = require("../src/config/db");
const connection = {
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

const { createInitialAdmin } = require("../scripts/createInitialAdmin");

describe("secure initial Admin setup", () => {
  const originalEnvironment = {
    INITIAL_ADMIN_NAME: process.env.INITIAL_ADMIN_NAME,
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL,
    INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INITIAL_ADMIN_NAME = "Initial Admin";
    process.env.INITIAL_ADMIN_EMAIL = "ADMIN@example.com";
    process.env.INITIAL_ADMIN_PASSWORD = "SecurePassword123";

    connection.execute.mockReset();
    connection.beginTransaction.mockResolvedValue(undefined);
    connection.commit.mockResolvedValue(undefined);
    connection.rollback.mockResolvedValue(undefined);
    connection.release.mockReturnValue(undefined);
    connection.execute.mockResolvedValueOnce([[{ acquired: 1 }]]);
    pool.getConnection.mockResolvedValue(connection);
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("creates the first Admin with a bcrypt password hash", async () => {
    connection.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([{}]);

    await expect(createInitialAdmin()).resolves.toBeUndefined();

    const insertCall = connection.execute.mock.calls.find(([query]) =>
      query.includes("INSERT INTO users")
    );
    expect(insertCall[0]).toContain("'ADMIN'");
    expect(insertCall[1][0]).toBe("Initial Admin");
    expect(insertCall[1][1]).toBe("admin@example.com");
    expect(insertCall[1][2]).not.toBe("SecurePassword123");
    await expect(
      require("bcrypt").compare(
        "SecurePassword123",
        insertCall[1][2]
      )
    ).resolves.toBe(true);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test("refuses to create another Admin if one already exists", async () => {
    connection.execute
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([{}]);

    await expect(createInitialAdmin()).rejects.toThrow(
      "An Admin account already exists"
    );

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test("validates setup credentials before connecting to the database", async () => {
    process.env.INITIAL_ADMIN_PASSWORD = "short";

    await expect(createInitialAdmin()).rejects.toThrow(
      "INITIAL_ADMIN_PASSWORD must be at least 8 characters"
    );
    expect(pool.getConnection).not.toHaveBeenCalled();
  });
});
