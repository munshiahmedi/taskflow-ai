
const pool = require("../config/db");
const bcrypt = require("bcrypt");

async function registerUser({ fullName, email, password }) {
  const [existingUsers] = await pool.execute(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (existingUsers.length > 0) {
    const error = new Error("Email is already registered");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [result] = await pool.execute(
      `INSERT INTO users
        (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'TEAM_MEMBER', 1)`,
      [fullName, email, passwordHash]
    );

    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email, role
       FROM users
       WHERE id = ?`,
      [result.insertId]
    );

    return rows[0];
  } catch (error) {
    // Handle duplicate emails, including concurrent registrations.
    if (error.code === "ER_DUP_ENTRY") {
      const duplicateError = new Error(
        "Email is already registered"
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
}

async function loginUser({ email, password }) {
  const [users] = await pool.execute(
    `SELECT id, full_name, email, password_hash,
            role, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  const user = users[0];

  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (!user.is_active) {
    const error = new Error("Account is inactive");
    error.statusCode = 403;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const jwt = require("jsonwebtoken");

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from server environment");
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}

module.exports = { registerUser, loginUser };
