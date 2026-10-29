
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
      `SELECT id, full_name, email, role, is_active, created_at
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
  console.log("[LOGIN DEBUG] 1. Starting database lookup");

  const [users] = await pool.execute(
    `SELECT id, full_name, email, password_hash,
            role, is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  console.log("[LOGIN DEBUG] 2. Database lookup completed");

  const user = users[0];

  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  console.log("[LOGIN DEBUG] 3. User found; checking account status");

  if (!user.is_active) {
    const error = new Error("Account is inactive");
    error.statusCode = 403;
    throw error;
  }

  console.log("[LOGIN DEBUG] 4. Comparing password");

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  console.log("[LOGIN DEBUG] 5. Password comparison completed");

  if (!passwordMatches) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  console.log("[LOGIN DEBUG] 6. Checking JWT configuration");

  const jwt = require("jsonwebtoken");

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from server environment");
  }

  console.log("[LOGIN DEBUG] 7. Signing token");

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

  console.log("[LOGIN DEBUG] 8. Token created successfully");

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
