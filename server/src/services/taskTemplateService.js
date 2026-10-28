const pool = require("../config/db");

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const templateFields = `
  id, service_type_id, name, version, is_active, created_at
`;
const itemFields = `
  id, template_id, title, description, sequence_no,
  due_days_after_start
`;

function mapDatabaseError(error) {
  if (error.code === "ER_DUP_ENTRY") {
    throw makeError(
      "Task template version or item sequence conflicts with an existing record",
      409
    );
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    throw makeError("Service type or template item reference not found", 404);
  }

  throw error;
}

async function withTransaction(work) {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function getTaskTemplates({ serviceTypeId, isActive }) {
  const conditions = [];
  const params = [];

  if (serviceTypeId !== undefined) {
    conditions.push("service_type_id = ?");
    params.push(serviceTypeId);
  }

  if (isActive !== undefined) {
    conditions.push("is_active = ?");
    params.push(isActive ? 1 : 0);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const [rows] = await pool.execute(
    `SELECT ${templateFields}
     FROM task_templates
     ${whereClause}
     ORDER BY service_type_id ASC, version DESC, id ASC`,
    params
  );

  return rows;
}

async function getTaskTemplateById(id) {
  const [templateRows] = await pool.execute(
    `SELECT ${templateFields}
     FROM task_templates
     WHERE id = ?`,
    [id]
  );

  if (templateRows.length === 0) {
    throw makeError("Task template not found", 404);
  }

  const [items] = await pool.execute(
    `SELECT ${itemFields}
     FROM task_template_items
     WHERE template_id = ?
     ORDER BY sequence_no ASC, id ASC`,
    [id]
  );

  return {
    ...templateRows[0],
    items,
  };
}

async function ensureActiveServiceType(connection, serviceTypeId) {
  const [rows] = await connection.execute(
    "SELECT id FROM service_types WHERE id = ? AND is_active = 1",
    [serviceTypeId]
  );

  if (rows.length === 0) {
    throw makeError("Service type not found or inactive", 404);
  }
}

async function insertItems(connection, templateId, items) {
  for (const item of items) {
    await connection.execute(
      `INSERT INTO task_template_items
        (template_id, title, description, sequence_no,
         due_days_after_start)
       VALUES (?, ?, ?, ?, ?)`,
      [
        templateId,
        item.title.trim(),
        item.description ?? null,
        item.sequence_no,
        item.due_days_after_start,
      ]
    );
  }
}

async function createTaskTemplate({
  serviceTypeId,
  name,
  version,
  items = [],
}) {
  try {
    const templateId = await withTransaction(async (connection) => {
      await ensureActiveServiceType(connection, serviceTypeId);

      const [result] = await connection.execute(
        `INSERT INTO task_templates
          (service_type_id, name, version)
         VALUES (?, ?, ?)`,
        [serviceTypeId, name, version]
      );

      if (items.length > 0) {
        await insertItems(connection, result.insertId, items);
      }

      return result.insertId;
    });

    return getTaskTemplateById(templateId);
  } catch (error) {
    return mapDatabaseError(error);
  }
}

async function applyItemUpdates(connection, templateId, items) {
  const [existingItems] = await connection.execute(
    `SELECT id, title, description, sequence_no, due_days_after_start
     FROM task_template_items
     WHERE template_id = ?
     FOR UPDATE`,
    [templateId]
  );

  const existingById = new Map(
    existingItems.map((item) => [item.id, item])
  );
  const submittedIds = new Set();
  const finalSequences = new Set();
  const updates = [];
  const inserts = [];

  for (const item of items) {
    let existing;

    if (item.id !== undefined) {
      existing = existingById.get(item.id);
      if (!existing || submittedIds.has(item.id)) {
        throw makeError(
          "Template item not found for this template",
          404
        );
      }
      submittedIds.add(item.id);
    }

    const finalSequence = item.sequence_no;
    if (finalSequences.has(finalSequence)) {
      throw makeError("Item sequence_no values must be unique", 400);
    }
    finalSequences.add(finalSequence);

    if (existing) {
      updates.push({ ...item, existing });
    } else {
      inserts.push(item);
    }
  }

  for (const existing of existingItems) {
    if (!submittedIds.has(existing.id)) {
      if (finalSequences.has(existing.sequence_no)) {
        throw makeError(
          "Item sequence_no conflicts with an item not included in the update",
          409
        );
      }
      finalSequences.add(existing.sequence_no);
    }
  }

  if (updates.length > 0) {
    const occupiedSequences = new Set([
      ...existingItems.map((item) => item.sequence_no),
      ...finalSequences,
    ]);
    let temporarySequence = -1;
    const temporarySequences = new Map();

    for (const existing of existingItems) {
      while (occupiedSequences.has(temporarySequence)) {
        temporarySequence -= 1;
      }

      if (temporarySequence < -2147483648) {
        throw makeError(
          "Unable to temporarily reorder template items",
          409
        );
      }

      temporarySequences.set(existing.id, temporarySequence);
      occupiedSequences.add(temporarySequence);
      temporarySequence -= 1;
    }

    for (const existing of existingItems) {
      await connection.execute(
        `UPDATE task_template_items
         SET sequence_no = ?
         WHERE id = ? AND template_id = ?`,
        [
          temporarySequences.get(existing.id),
          existing.id,
          templateId,
        ]
      );
    }

    const updateById = new Map(
      updates.map((item) => [item.id, item])
    );

    for (const existing of existingItems) {
      const update = updateById.get(existing.id);
      if (update) {
        await connection.execute(
          `UPDATE task_template_items
           SET title = ?, description = ?, sequence_no = ?,
               due_days_after_start = ?
           WHERE id = ? AND template_id = ?`,
          [
            update.title.trim(),
            update.description === undefined
              ? existing.description
              : update.description,
            update.sequence_no,
            update.due_days_after_start,
            existing.id,
            templateId,
          ]
        );
      } else {
        await connection.execute(
          `UPDATE task_template_items
           SET sequence_no = ?
           WHERE id = ? AND template_id = ?`,
          [existing.sequence_no, existing.id, templateId]
        );
      }
    }
  }

  if (inserts.length > 0) {
    await insertItems(connection, templateId, inserts);
  }
}

async function updateTaskTemplate(id, updates) {
  try {
    await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        "SELECT id FROM task_templates WHERE id = ? FOR UPDATE",
        [id]
      );

      if (existingRows.length === 0) {
        throw makeError("Task template not found", 404);
      }

      if (updates.serviceTypeId !== undefined) {
        await ensureActiveServiceType(connection, updates.serviceTypeId);

        const [engagementRows] = await connection.execute(
          `SELECT id
           FROM engagements
           WHERE template_id = ?
           LIMIT 1`,
          [id]
        );

        if (engagementRows.length > 0) {
          const [currentTemplateRows] = await connection.execute(
            "SELECT service_type_id FROM task_templates WHERE id = ?",
            [id]
          );
          if (
            currentTemplateRows[0].service_type_id !==
            updates.serviceTypeId
          ) {
            throw makeError(
              "A template used by an engagement cannot be reassigned to another service type",
              409
            );
          }
        }
      }

      const fields = [];
      const values = [];

      if (updates.serviceTypeId !== undefined) {
        fields.push("service_type_id = ?");
        values.push(updates.serviceTypeId);
      }
      if (updates.name !== undefined) {
        fields.push("name = ?");
        values.push(updates.name);
      }
      if (updates.version !== undefined) {
        fields.push("version = ?");
        values.push(updates.version);
      }

      if (fields.length > 0) {
        values.push(id);
        await connection.execute(
          `UPDATE task_templates
           SET ${fields.join(", ")}
           WHERE id = ?`,
          values
        );
      }

      if (updates.items !== undefined) {
        await applyItemUpdates(connection, id, updates.items);
      }
    });

    return getTaskTemplateById(id);
  } catch (error) {
    return mapDatabaseError(error);
  }
}

async function updateTaskTemplateStatus(id, isActive) {
  const [existingRows] = await pool.execute(
    "SELECT id FROM task_templates WHERE id = ?",
    [id]
  );

  if (existingRows.length === 0) {
    throw makeError("Task template not found", 404);
  }

  await pool.execute(
    `UPDATE task_templates
     SET is_active = ?
     WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );

  return getTaskTemplateById(id);
}

module.exports = {
  getTaskTemplates,
  getTaskTemplateById,
  createTaskTemplate,
  updateTaskTemplate,
  updateTaskTemplateStatus,
};
