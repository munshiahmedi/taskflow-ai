require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../.env"),
  quiet: true,
});

const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

const SETUP_LOCK = "taskflow_initial_admin_setup";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createInitialAdmin() {
  const fullName = process.env.INITIAL_ADMIN_NAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!fullName || fullName.length > 100) {
    throw new Error("Set a valid INITIAL_ADMIN_NAME (1-100 characters).");
  }

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    throw new Error("Set a valid INITIAL_ADMIN_EMAIL.");
  }

  if (
    !password ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD must be at least 8 characters and at most 72 UTF-8 bytes."
    );
  }

  const connection = await pool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    const [lockRows] = await connection.execute(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [SETUP_LOCK]
    );

    if (Number(lockRows[0]?.acquired) !== 1) {
      throw new Error(
        "Could not acquire the initial Admin setup lock; try again."
      );
    }

    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;

    const [admins] = await connection.execute(
      "SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1 FOR UPDATE"
    );

    if (admins.length > 0) {
      throw new Error(
        "An Admin account already exists; initial setup cannot be reused."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute(
      `INSERT INTO users
        (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'ADMIN', 1)`,
      [fullName, email, passwordHash]
    );

    await connection.commit();
    transactionStarted = false;
    console.log("Initial Admin account created successfully.");
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    if (error.code === "ER_DUP_ENTRY") {
      throw new Error(
        "An account with INITIAL_ADMIN_EMAIL already exists."
      );
    }

    throw error;
  } finally {
    try {
      if (lockAcquired) {
        await connection.execute("SELECT RELEASE_LOCK(?)", [SETUP_LOCK]);
      }
    } finally {
      connection.release();
    }
  }
}

if (require.main === module) {
  createInitialAdmin()
    .catch((error) => {
      console.error(`Initial Admin setup failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

module.exports = { createInitialAdmin };
