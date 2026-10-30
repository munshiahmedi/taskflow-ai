
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_LOCAL_MANAGER_PASSWORD_RESET !== "true"
  ) {
    throw new Error(
      "This local-only utility requires ALLOW_LOCAL_MANAGER_PASSWORD_RESET=true outside production."
    );
  }

  const email = process.env.LOCAL_MANAGER_EMAIL?.trim().toLowerCase();
  const temporaryPassword = process.env.LOCAL_MANAGER_PASSWORD;

  if (!email || !temporaryPassword) {
    throw new Error(
      "Set LOCAL_MANAGER_EMAIL and LOCAL_MANAGER_PASSWORD in the local environment."
    );
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const [result] = await pool.execute(
    `UPDATE users
     SET password_hash = ?, is_active = 1
     WHERE email = ? AND role = 'MANAGER'`,
    [passwordHash, email]
  );

  if (result.affectedRows !== 1) {
    throw new Error(
      "Expected exactly one manager account. Check the email and role."
    );
  }

  console.log("Local manager password updated successfully.");
}

main()
  .catch((error) => {
    console.error("Password update failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
