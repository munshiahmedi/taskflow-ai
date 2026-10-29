require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 4000),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: "sys",
      ssl: { minVersion: "TLSv1.2" }
    });

    const [rows] = await conn.query(
      "SELECT CURRENT_USER() AS account, DATABASE() AS db, @@port AS port"
    );
    console.log(rows);

    const [dbs] = await conn.query(
      "SHOW DATABASES LIKE 'taskflow_ai'"
    );
    console.log("taskflow_ai:", dbs);
  } catch (err) {
    console.log("ERROR:", err.code, err.message);
  } finally {
    if (conn) await conn.end();
  }
})();
