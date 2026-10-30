require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../.env"),
  quiet: true,
});

const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_MAX_BYTES = 72;

function validateEmail(email) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    email.trim() !== email ||
    !EMAIL_REGEX.test(email)
  ) {
    throw new Error(
      "Provide the exact Admin email address as the only command-line argument."
    );
  }
}

function validatePassword(password) {
  const categories = [
    /\p{Lu}/u,
    /\p{Ll}/u,
    /\p{N}/u,
    /[\p{P}\p{S}]/u,
  ];

  if (
    typeof password !== "string" ||
    [...password].length < 12 ||
    Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES ||
    categories.some((category) => !category.test(password))
  ) {
    throw new Error(
      "Password must be at least 12 characters, include uppercase and lowercase letters, a number, and a symbol, and be no more than 72 UTF-8 bytes."
    );
  }
}

function promptHidden(promptText) {
  const { stdin, stdout } = process;

  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command from an interactive terminal.");
  }

  stdout.write(promptText);

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      stdin.removeListener("data", handleInput);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    }

    function handleInput(chunk) {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password entry cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = [...value].slice(0, -1).join("");
        } else {
          value += character;
        }
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", handleInput);
  });
}

async function resetAdminPassword(email, password) {
  validateEmail(email);
  validatePassword(password);

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [users] = await connection.execute(
      `SELECT id, role, is_active
       FROM users
       WHERE email = ?
       LIMIT 1
       FOR UPDATE`,
      [email]
    );
    const user = users[0];

    if (!user) {
      throw new Error("No account exists for the supplied email.");
    }

    if (user.role !== "ADMIN") {
      throw new Error("The supplied account is not an Admin.");
    }

    if (!user.is_active) {
      throw new Error("The Admin account is inactive.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute(
      `UPDATE users
       SET password_hash = ?
       WHERE id = ? AND email = ? AND role = 'ADMIN' AND is_active = 1`,
      [passwordHash, user.id, email]
    );

    if (result.affectedRows !== 1) {
      throw new Error(
        "The active Admin account changed during reset; no password was updated."
      );
    }

    await connection.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  const [email, ...extraArguments] = process.argv.slice(2);
  if (!email || extraArguments.length > 0) {
    throw new Error(
      "Usage: npm run reset:admin-password -- <exact-admin-email>"
    );
  }

  validateEmail(email);
  const password = await promptHidden("New Admin password: ");
  const confirmation = await promptHidden("Confirm new password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  validatePassword(password);
  await resetAdminPassword(email, password);
  console.log("Admin password updated successfully.");
}

if (require.main === module) {
  main()
    .catch((error) => {
      const safeMessages = new Set([
        "Provide the exact Admin email address as the only command-line argument.",
        "Run this command from an interactive terminal.",
        "Password entry cancelled.",
        "Passwords do not match.",
        "No account exists for the supplied email.",
        "The supplied account is not an Admin.",
        "The Admin account is inactive.",
        "The active Admin account changed during reset; no password was updated.",
        "Password must be at least 12 characters, include uppercase and lowercase letters, a number, and a symbol, and be no more than 72 UTF-8 bytes.",
        "Usage: npm run reset:admin-password -- <exact-admin-email>",
      ]);
      console.error(
        `Admin password reset failed: ${
          safeMessages.has(error.message)
            ? error.message
            : "Unexpected reset failure."
        }`
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

module.exports = {
  resetAdminPassword,
  validateEmail,
  validatePassword,
};
