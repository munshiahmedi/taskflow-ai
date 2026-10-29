require("dotenv").config();
const fs = require("node:fs");
const mysql = require("mysql2/promise");

(async () => {
  let conn;
  try {
    const sql = fs.readFileSync("./sql/schema.sql", "utf8");
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 4000),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true }
    });

    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await conn.query(statement);
      console.log("Executed:", statement.match(/CREATE TABLE\s+(\w+)/i)?.[1] || "statement");
    }

    console.log(`SUCCESS: ${statements.length} statements executed.`);
  } catch (err) {
    console.error("SCHEMA ERROR:", err.code, err.message);
  } finally {
    if (conn) await conn.end();
  }
})();
