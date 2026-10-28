
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

async function main() {
  const email = "manager.test@taskflow.local";
  const temporaryPassword = "LocalManager@2026";

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
