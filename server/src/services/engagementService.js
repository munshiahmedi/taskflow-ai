

const pool = require("../config/db");

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Validate that an ID is a positive integer.
function isValidId(value) {
  return Number.isInteger(value) && value > 0;
}

// Validate the YYYY-MM-DD format and the actual calendar date.
function isValidDate(dateString) {
  if (typeof dateString !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getPeriodKey(startDate, interval) {
  const [year, month] = startDate.split("-").map(Number);

  if (interval === "MONTHLY") {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  if (interval === "QUARTERLY") {
    return `${year}-Q${Math.ceil(month / 3)}`;
  }

  if (interval === "YEARLY") {
    return String(year);
  }

  throw makeError("Invalid recurrence interval", 400);
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days));

  return date.toISOString().slice(0, 10);
}

async function createEngagement(data, user) {
  const {
    clientId,
    serviceTypeId,
    templateId,
    name,
    engagementKind,
    periodStart,
    periodEnd,
  } = data;

  // Validate IDs and name.
  if (
    !isValidId(clientId) ||
    !isValidId(serviceTypeId) ||
    !isValidId(templateId) ||
    typeof name !== "string" ||
    !name.trim()
  ) {
    throw makeError(
      "Valid positive clientId, serviceTypeId, templateId and name are required",
      400
    );
  }

  // Validate engagement kind.
  if (!["ONE_TIME", "RECURRING"].includes(engagementKind)) {
    throw makeError("Invalid engagement kind", 400);
  }

  // Validate actual dates and date order.
  if (
    !isValidDate(periodStart) ||
    !isValidDate(periodEnd) ||
    periodStart > periodEnd
  ) {
    throw makeError(
      "Valid periodStart and periodEnd dates are required",
      400
    );
  }

  const [services] = await pool.execute(
    `SELECT id, engagement_kind, recurrence_interval
     FROM service_types
     WHERE id = ? AND is_active = 1`,
    [serviceTypeId]
  );

  if (services.length === 0) {
    throw makeError("Service type not found or inactive", 404);
  }

  const service = services[0];

  if (service.engagement_kind !== engagementKind) {
    throw makeError(
      "Engagement kind must match the selected service type",
      400
    );
  }

  let recurrenceKey = null;

  if (engagementKind === "RECURRING") {
    if (!service.recurrence_interval) {
      throw makeError(
        "Recurring service must have a recurrence interval",
        400
      );
    }

    recurrenceKey = getPeriodKey(
      periodStart,
      service.recurrence_interval
    );
  }

  const [clients] = await pool.execute(
    "SELECT id FROM clients WHERE id = ?",
    [clientId]
  );

  if (clients.length === 0) {
    throw makeError("Client not found", 404);
  }

  const [templates] = await pool.execute(
    `SELECT id
     FROM task_templates
     WHERE id = ? AND service_type_id = ? AND is_active = 1`,
    [templateId, serviceTypeId]
  );

  if (templates.length === 0) {
    throw makeError(
      "Active template not found for this service type",
      400
    );
  }

  const [items] = await pool.execute(
    `SELECT id, title, description, due_days_after_start
     FROM task_template_items
     WHERE template_id = ?
     ORDER BY sequence_no, id`,
    [templateId]
  );

  if (items.length === 0) {
    throw makeError("Selected template has no task items", 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO engagements
        (client_id, service_type_id, template_id, name,
         engagement_kind, period_start, period_end,
         recurrence_period_key, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        serviceTypeId,
        templateId,
        name.trim(),
        engagementKind,
        periodStart,
        periodEnd,
        recurrenceKey,
        user.id,
      ]
    );

    const engagementId = result.insertId;

    for (const item of items) {
      const dueDate = addDays(
        periodStart,
        item.due_days_after_start
      );

      await connection.execute(
        `INSERT INTO tasks
          (engagement_id, template_item_id, title, description,
           created_by, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'NOT_STARTED')`,
        [
          engagementId,
          item.id,
          item.title,
          item.description,
          user.id,
          dueDate,
        ]
      );
    }

    await connection.commit();

    return {
      id: engagementId,
      client_id: clientId,
      service_type_id: serviceTypeId,
      template_id: templateId,
      name: name.trim(),
      engagement_kind: engagementKind,
      period_start: periodStart,
      period_end: periodEnd,
      recurrence_period_key: recurrenceKey,
      created_by: user.id,
      generated_task_count: items.length,
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      throw makeError(
        "A recurring engagement already exists for this client, service and period",
        409
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}
async function getEngagements(user) {
  let query = `
    SELECT
      e.id,
      e.client_id,
      e.service_type_id,
      e.template_id,
      e.name,
      e.engagement_kind,
      e.period_start,
      e.period_end,
      e.recurrence_period_key,
      e.created_by,
      c.name AS client_name
    FROM engagements e
    JOIN clients c ON c.id = e.client_id
  `;

  const params = [];

  // Managers see only engagements they created.
  if (user.role === "MANAGER") {
    query += " WHERE e.created_by = ?";
    params.push(user.id);
  }

  query += " ORDER BY e.id DESC";

  const [engagements] = await pool.execute(query, params);

  return engagements;
}
module.exports = { createEngagement,getEngagements };
