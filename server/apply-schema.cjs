require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function getSslOptions() {
  if (process.env.DB_SSL !== "true") {
    return {};
  }

  const ssl = {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  };
  const caPath = process.env.DB_SSL_CA?.trim();

  if (caPath) {
    ssl.ca = fs.readFileSync(path.resolve(caPath));
  }

  return { ssl };
}

(async () => {
  let conn;
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "sql", "schema.sql"),
      "utf8"
    );
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ...getSslOptions(),
    });

    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await conn.query(statement);
      const tableName =
        statement.match(/CREATE TABLE\s+(\w+)/i)?.[1] || "statement";
      console.log("Executed:", tableName);
    }

    console.log(`SUCCESS: ${statements.length} statements executed.`);
  } catch (err) {
    console.error("Schema setup failed", {
      code: err.code || "UNKNOWN",
      message: err.message,
    });
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
