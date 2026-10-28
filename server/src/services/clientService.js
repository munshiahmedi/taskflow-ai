const pool = require("../config/db");

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const clientFields = `
  id, name, email, phone, is_active, created_at, updated_at
`;

async function getClients({ search, isActive }) {
  const conditions = [];
  const params = [];

  if (search !== undefined) {
    conditions.push("(name LIKE ? OR email LIKE ?)");
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }
  if (isActive !== undefined) {
    conditions.push("is_active = ?");
    params.push(isActive ? 1 : 0);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.execute(
    `SELECT ${clientFields}
     FROM clients
     ${whereClause}
     ORDER BY name ASC, id ASC`,
    params
  );
  return rows;
}

async function getClientById(id) {
  const [rows] = await pool.execute(
    `SELECT ${clientFields} FROM clients WHERE id = ?`,
    [id]
  );

  if (rows.length === 0) {
    throw makeError("Client not found", 404);
  }
  return rows[0];
}

async function createClient({ name, email, phone }) {
  const [result] = await pool.execute(
    `INSERT INTO clients (name, email, phone)
     VALUES (?, ?, ?)`,
    [name, email, phone]
  );
  return getClientById(result.insertId);
}

async function updateClient(id, updates) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    fields.push("email = ?");
    values.push(updates.email);
  }
  if (updates.phone !== undefined) {
    fields.push("phone = ?");
    values.push(updates.phone);
  }

  const [existingRows] = await pool.execute(
    "SELECT id FROM clients WHERE id = ?",
    [id]
  );
  if (existingRows.length === 0) {
    throw makeError("Client not found", 404);
  }

  values.push(id);
  await pool.execute(
    `UPDATE clients
     SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    values
  );
  return getClientById(id);
}

async function updateClientStatus(id, isActive) {
  const [existingRows] = await pool.execute(
    "SELECT id FROM clients WHERE id = ?",
    [id]
  );
  if (existingRows.length === 0) {
    throw makeError("Client not found", 404);
  }

  await pool.execute(
    `UPDATE clients
     SET is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
  return getClientById(id);
}

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  updateClientStatus,
};
