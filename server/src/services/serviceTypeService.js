const pool = require("../config/db");

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const serviceTypeFields = `
  id, name, description, engagement_kind, recurrence_interval,
  is_active, created_at
`;

function throwDuplicateNameError(error) {
  if (error.code === "ER_DUP_ENTRY") {
    throw makeError("A service type with this name already exists", 409);
  }

  throw error;
}

async function getServiceTypes({ search, isActive }) {
  const conditions = [];
  const params = [];

  if (search !== undefined) {
    conditions.push("(name LIKE ? OR description LIKE ?)");
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
    `SELECT ${serviceTypeFields}
     FROM service_types
     ${whereClause}
     ORDER BY name ASC, id ASC`,
    params
  );

  return rows;
}

async function getServiceTypeById(id) {
  const [rows] = await pool.execute(
    `SELECT ${serviceTypeFields}
     FROM service_types
     WHERE id = ?`,
    [id]
  );

  if (rows.length === 0) {
    throw makeError("Service type not found", 404);
  }

  return rows[0];
}

async function createServiceType({
  name,
  description,
  engagementKind,
  recurrenceInterval,
}) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO service_types
        (name, description, engagement_kind, recurrence_interval)
       VALUES (?, ?, ?, ?)`,
      [name, description, engagementKind, recurrenceInterval]
    );

    return getServiceTypeById(result.insertId);
  } catch (error) {
    return throwDuplicateNameError(error);
  }
}

async function updateServiceType(id, updates) {
  const [existingRows] = await pool.execute(
    "SELECT id FROM service_types WHERE id = ?",
    [id]
  );

  if (existingRows.length === 0) {
    throw makeError("Service type not found", 404);
  }

  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }

  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }

  if (updates.engagementKind !== undefined) {
    fields.push("engagement_kind = ?");
    values.push(updates.engagementKind);
  }

  if (updates.recurrenceInterval !== undefined) {
    fields.push("recurrence_interval = ?");
    values.push(updates.recurrenceInterval);
  }

  values.push(id);

  try {
    await pool.execute(
      `UPDATE service_types
       SET ${fields.join(", ")}
       WHERE id = ?`,
      values
    );
  } catch (error) {
    return throwDuplicateNameError(error);
  }

  return getServiceTypeById(id);
}

async function updateServiceTypeStatus(id, isActive) {
  const [existingRows] = await pool.execute(
    "SELECT id FROM service_types WHERE id = ?",
    [id]
  );

  if (existingRows.length === 0) {
    throw makeError("Service type not found", 404);
  }

  await pool.execute(
    `UPDATE service_types
     SET is_active = ?
     WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );

  return getServiceTypeById(id);
}

module.exports = {
  getServiceTypes,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  updateServiceTypeStatus,
};
