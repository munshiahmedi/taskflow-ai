require("dotenv").config();
process.env.DB_NAME = "sys";

const pool = require("./src/config/db");

async function main() {
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      ["taskflow_ai"]
    );

    console.log("Database lookup result:", rows);
  } catch (error) {
    console.log("DB ERROR:", error.code, error.message);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

main();
