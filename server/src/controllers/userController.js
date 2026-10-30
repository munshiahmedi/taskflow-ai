const bcrypt = require("bcrypt");
const pool = require("../config/db");

const USER_ROLES = ["ADMIN", "MANAGER", "TEAM_MEMBER"];
const ASSIGNABLE_ROLES = ["MANAGER", "TEAM_MEMBER"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_MUTATION_LOCK = "taskflow_admin_user_mutation";

function toSafeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.isActive),
  };
}

function invalidUserInput(fullName, email, password) {
  if (
    typeof fullName !== "string" ||
    !fullName.trim() ||
    fullName.trim().length > 100
  ) {
    return "Name is required and must not exceed 100 characters";
  }

  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !EMAIL_REGEX.test(email.trim())
  ) {
    return "A valid email address is required";
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return "Password must be at least 8 characters and at most 72 UTF-8 bytes";
  }

  return null;
}

async function withAdminMutationLock(callback) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    const [lockRows] = await connection.execute(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [ADMIN_MUTATION_LOCK]
    );

    if (Number(lockRows[0]?.acquired) !== 1) {
      const error = new Error("Unable to acquire user-management lock");
      error.statusCode = 503;
      throw error;
    }

    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;

    const result = await callback(connection);
    await connection.commit();
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    throw error;
  } finally {
    try {
      if (lockAcquired) {
        await connection.execute("SELECT RELEASE_LOCK(?)", [
          ADMIN_MUTATION_LOCK,
        ]);
      }
    } finally {
      connection.release();
    }
  }
}

async function preserveLastActiveAdmin(connection, targetId) {
  const [admins] = await connection.execute(
    `SELECT id
     FROM users
     WHERE role = 'ADMIN' AND is_active = 1
     FOR UPDATE`
  );

  if (
    admins.length <= 1 &&
    admins.some((admin) => Number(admin.id) === Number(targetId))
  ) {
    const error = new Error(
      "Cannot remove or deactivate the last active administrator"
    );
    error.statusCode = 409;
    throw error;
  }
}

async function getUsers(req, res, next) {
  const { search = "", role = "" } = req.query;

  if (typeof search !== "string" || search.length > 254) {
    return res.status(400).json({
      success: false,
      message: "Search must not exceed 254 characters",
    });
  }

  if (role && !USER_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "A valid role filter is required",
    });
  }

  try {
    let sql = `SELECT id, full_name AS fullName, email, role,
                      is_active AS isActive
               FROM users`;
    const conditions = [];
    const parameters = [];

    if (search.trim()) {
      conditions.push("(full_name LIKE ? OR email LIKE ?)");
      const query = `%${search.trim()}%`;
      parameters.push(query, query);
    }

    if (role) {
      conditions.push("role = ?");
      parameters.push(role);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY full_name ASC, id ASC";

    const [rows] = await pool.execute(sql, parameters);

    return res.status(200).json({
      success: true,
      users: rows.map(toSafeUser),
    });
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  const { fullName, email, password, role } = req.body || {};
  const validationError = invalidUserInput(fullName, email, password);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Only MANAGER and TEAM_MEMBER accounts can be created here",
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users
        (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [fullName.trim(), normalizedEmail, passwordHash, role]
    );
    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email, role,
              is_active AS isActive
       FROM users
       WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: toSafeUser(rows[0]),
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    return next(error);
  }
}

async function getTeamMembers(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email
       FROM users
       WHERE role = 'TEAM_MEMBER' AND is_active = 1
       ORDER BY full_name ASC`
    );

    return res.status(200).json({
      success: true,
      members: rows.map(({ id, fullName, email }) => ({
        id,
        fullName,
        email,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUserRole(req, res, next) {
  const id = Number(req.params.id);
  const { role } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "User ID must be a positive integer",
    });
  }

  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "A valid user role is required",
    });
  }

  try {
    const user = await withAdminMutationLock(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, full_name AS fullName, email, role,
                is_active AS isActive
         FROM users
         WHERE id = ?
         FOR UPDATE`,
        [id]
      );

      if (rows.length === 0) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      const existingUser = rows[0];
      if (
        existingUser.role === "ADMIN" &&
        role !== "ADMIN" &&
        existingUser.isActive
      ) {
        await preserveLastActiveAdmin(connection, id);
      }

      if (existingUser.role !== role) {
        await connection.execute(
          "UPDATE users SET role = ? WHERE id = ?",
          [role, id]
        );
      }

      return toSafeUser({ ...existingUser, role });
    });

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  const id = Number(req.params.id);
  const { fullName, email } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "User ID must be a positive integer",
    });
  }

  if (
    typeof fullName !== "string" ||
    !fullName.trim() ||
    fullName.trim().length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Name is required and must not exceed 100 characters",
    });
  }

  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !EMAIL_REGEX.test(email.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid email address is required",
    });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE users
       SET full_name = ?, email = ?
       WHERE id = ?`,
      [fullName.trim(), email.trim().toLowerCase(), id]
    );

    if (result.affectedRows === 0) {
      const [rows] = await pool.execute(
        "SELECT id FROM users WHERE id = ?",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
    }

    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email, role,
              is_active AS isActive
       FROM users
       WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      user: toSafeUser(rows[0]),
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    return next(error);
  }
}

async function updateUserStatus(req, res, next) {
  const id = Number(req.params.id);
  const { isActive } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "User ID must be a positive integer",
    });
  }

  if (typeof isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be a boolean",
    });
  }

  try {
    const user = await withAdminMutationLock(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, full_name AS fullName, email, role,
                is_active AS isActive
         FROM users
         WHERE id = ?
         FOR UPDATE`,
        [id]
      );

      if (rows.length === 0) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      const existingUser = rows[0];
      if (
        existingUser.role === "ADMIN" &&
        existingUser.isActive &&
        !isActive
      ) {
        await preserveLastActiveAdmin(connection, id);
      }

      await connection.execute(
        "UPDATE users SET is_active = ? WHERE id = ?",
        [isActive ? 1 : 0, id]
      );

      return toSafeUser({ ...existingUser, isActive });
    });

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
      user,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getUsers,
  createUser,
  getTeamMembers,
  updateUser,
  updateUserRole,
  updateUserStatus,
};
