
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

function getSslOptions() {
  // Enable TLS when DB_SSL is set to "true"
  if (process.env.DB_SSL !== "true") {
    return {};
  }

  const ssl = {
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  };

  // Optional CA certificate file
  const caPath = process.env.DB_SSL_CA?.trim();

  if (caPath) {
    ssl.ca = fs.readFileSync(path.resolve(caPath));
  }

  return { ssl };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ...getSslOptions(),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
