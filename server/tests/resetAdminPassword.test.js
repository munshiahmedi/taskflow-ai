jest.mock("../src/config/db", () => ({
  getConnection: jest.fn(),
}));

const bcrypt = require("bcrypt");
const pool = require("../src/config/db");
const {
  resetAdminPassword,
  validateEmail,
  validatePassword,
} = require("../scripts/resetAdminPassword");

const connection = {
  execute: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

const validEmail = "taskflow.admin.test@example.com";
const validPassword = "StrongReset123!";

describe("CLI Admin password reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connection.execute.mockReset();
    connection.beginTransaction.mockResolvedValue(undefined);
    connection.commit.mockResolvedValue(undefined);
    connection.rollback.mockResolvedValue(undefined);
    connection.release.mockReturnValue(undefined);
    pool.getConnection.mockResolvedValue(connection);
  });

  test("updates only the password hash for the matching active Admin", async () => {
    connection.execute
      .mockResolvedValueOnce([
        [{ id: 30002, role: "ADMIN", is_active: 1 }],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await expect(
      resetAdminPassword(validEmail, validPassword)
    ).resolves.toBeUndefined();

    expect(connection.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE email = ?"),
      [validEmail]
    );

    const [updateQuery, updateValues] = connection.execute.mock.calls[1];
    expect(updateQuery).toContain("SET password_hash = ?");
    expect(updateQuery).not.toMatch(/SET\s+[^;]*,/i);
    expect(updateQuery).toContain("role = 'ADMIN'");
    expect(updateQuery).toContain("is_active = 1");
    expect(updateValues[0]).not.toBe(validPassword);
    expect(updateValues.slice(1)).toEqual([30002, validEmail]);
    await expect(bcrypt.compare(validPassword, updateValues[0])).resolves.toBe(
      true
    );
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["does not exist", [], "No account exists"],
    [
      "is inactive",
      [{ id: 30002, role: "ADMIN", is_active: 0 }],
      "The Admin account is inactive",
    ],
    [
      "is not an Admin",
      [{ id: 4, role: "MANAGER", is_active: 1 }],
      "The supplied account is not an Admin",
    ],
  ])("refuses an account that %s", async (_case, users, errorMessage) => {
    connection.execute.mockResolvedValueOnce([users]);

    await expect(
      resetAdminPassword(validEmail, validPassword)
    ).rejects.toThrow(errorMessage);

    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test("validates the explicit email and password before connecting", async () => {
    expect(() => validateEmail(" admin@example.com")).toThrow(
      "exact Admin email"
    );
    expect(() => validatePassword("weak")).toThrow("at least 12 characters");
    expect(pool.getConnection).not.toHaveBeenCalled();
  });
});
