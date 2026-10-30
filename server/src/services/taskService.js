
const pool = require("../config/db");

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Check whether the user can access this task.
// Managers can access tasks in engagements they created.
// Team members can access tasks assigned to them.
async function getAuthorizedTask(id, user) {
  let sql = `
    SELECT t.id, t.engagement_id, t.title, t.description,
           t.created_by, t.assigned_to, t.status, t.created_at,
           t.updated_at
    FROM tasks t
    LEFT JOIN engagements e ON e.id = t.engagement_id
    WHERE t.id = ?
  `;

  const params = [id];

  if (user.role === "MANAGER") {
    sql += " AND e.created_by = ?";
    params.push(user.id);
  } else if (user.role === "TEAM_MEMBER") {
    sql += " AND t.assigned_to = ?";
    params.push(user.id);
  } else if (user.role !== "ADMIN") {
    throw makeError("You do not have permission", 403);
  }

  const [rows] = await pool.execute(sql, params);

  if (rows.length === 0) {
    // Avoid revealing whether an inaccessible task exists.
    throw makeError("Task not found or access denied", 404);
  }

  return rows[0];
}


async function createTask({ engagementId, title, description, createdBy, role }) {
  const [engagements] = await pool.execute(
    "SELECT id, created_by FROM engagements WHERE id = ?",
    [engagementId]
  );

  if (engagements.length === 0) {
    throw makeError("Engagement not found", 404);
  }

  const engagement = engagements[0];

  if (role === "MANAGER" && engagement.created_by !== createdBy) {
    throw makeError(
      "You can only create tasks in your own engagements",
      403
    );
  }

  if (!["ADMIN", "MANAGER"].includes(role)) {
    throw makeError("You do not have permission", 403);
  }

  const [users] = await pool.execute(
    "SELECT id FROM users WHERE id = ? AND is_active = 1",
    [createdBy]
  );

  if (users.length === 0) {
    throw makeError("Creator not found or inactive", 404);
  }

  const [result] = await pool.execute(
    `INSERT INTO tasks
      (engagement_id, title, description, created_by, status)
     VALUES (?, ?, ?, ?, 'NOT_STARTED')`,
    [engagementId, title, description ?? null, createdBy]
  );

  const [rows] = await pool.execute(
    `SELECT id, engagement_id, title, description,
            created_by, assigned_to, status, created_at
     FROM tasks WHERE id = ?`,
    [result.insertId]
  );

  return rows[0];
}


async function getTasks(user) {
  let sql = `
    SELECT t.id, t.engagement_id, t.title, t.description,
           t.created_by, t.assigned_to, t.status, t.due_date,
           assigned_user.full_name AS assigned_to_name, t.created_at,
           e.name AS engagement_name, e.client_id,
           c.name AS client_name
    FROM tasks t
    LEFT JOIN engagements e ON e.id = t.engagement_id
    LEFT JOIN clients c ON c.id = e.client_id
    LEFT JOIN users assigned_user ON assigned_user.id = t.assigned_to
  `;

  const params = [];

  if (user.role === "MANAGER") {
    sql += " WHERE e.created_by = ?";
    params.push(user.id);
  } else if (user.role === "TEAM_MEMBER") {
    sql += " WHERE t.assigned_to = ?";
    params.push(user.id);
  } else if (user.role !== "ADMIN") {
    throw makeError("You do not have permission", 403);
  }

  sql += " ORDER BY t.created_at DESC, t.id DESC";

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getTaskById(id, user) {
  return getAuthorizedTask(id, user);
}

async function updateTask(id, { title, description }, user) {
  await getAuthorizedTask(id, user);

  const fields = [];
  const values = [];

  if (title !== undefined) {
    fields.push("title = ?");
    values.push(title);
  }

  if (description !== undefined) {
    fields.push("description = ?");
    values.push(description);
  }

  if (fields.length === 0) {
    throw makeError("Provide title or description to update", 400);
  }

  values.push(id);

  await pool.execute(
    `UPDATE tasks
     SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    values
  );

  const [rows] = await pool.execute(
    `SELECT id, engagement_id, title, description,
            created_by, assigned_to, status, created_at, updated_at
     FROM tasks WHERE id = ?`,
    [id]
  );

  return rows[0];
}

async function deleteTask(id, user) {
  await getAuthorizedTask(id, user);

  await pool.execute("DELETE FROM tasks WHERE id = ?", [id]);

  return { id };
}

async function assignTask(id, assignedTo, user) {
  // Check task exists and user is authorized to access it
  const task = await getAuthorizedTask(id, user);

  // Only ADMIN or MANAGER can assign tasks
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    throw makeError("You do not have permission", 403);
  }

  // Ensure the assigned user is an active TEAM_MEMBER
  const [users] = await pool.execute(
    `SELECT id
     FROM users
     WHERE id = ?
       AND role = 'TEAM_MEMBER'
       AND is_active = 1`,
    [assignedTo]
  );

  if (users.length === 0) {
    throw makeError(
      "Active team member not found",
      404
    );
  }

  // Update assignment
  await pool.execute(
    `UPDATE tasks
     SET assigned_to = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [assignedTo, id]
  );

  // Return updated task
  const [rows] = await pool.execute(
    `SELECT id, engagement_id, title, description,
            created_by, assigned_to, status, created_at, updated_at
     FROM tasks
     WHERE id = ?`,
    [id]
  );

  return rows[0];
}

async function updateTaskStatus(id, newStatus, user, comment = null) {
  const task = await getAuthorizedTask(id, user);
  const oldStatus = task.status;

  if (oldStatus === newStatus) {
    throw makeError("Task already has this status", 400);
  }

  const teamMemberTransitions = {
    NOT_STARTED: ["IN_PROGRESS"],
    IN_PROGRESS: ["WAITING_FOR_CLIENT", "READY_FOR_REVIEW"],
    WAITING_FOR_CLIENT: ["IN_PROGRESS"],
    CHANGES_REQUESTED: ["IN_PROGRESS", "READY_FOR_REVIEW"],
  };

  const reviewTransitions = {
    READY_FOR_REVIEW: ["COMPLETED", "CHANGES_REQUESTED"],
  };

  if (user.role === "TEAM_MEMBER") {
    const allowed = teamMemberTransitions[oldStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw makeError(
        "Team members cannot make this status transition",
        403
      );
    }
  } else if (user.role === "MANAGER") {
    const allowed = reviewTransitions[oldStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw makeError(
        "Managers can only review tasks that are ready for review",
        403
      );
    }

  if (task.assigned_to === user.id) {
  throw makeError("You cannot approve your own task", 403);
}

    if (newStatus === "CHANGES_REQUESTED" && !comment?.trim()) {
      throw makeError(
        "A review comment is required when requesting changes",
        400
      );
    }
  } else if (user.role === "ADMIN") {
    const allowed = reviewTransitions[oldStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw makeError(
        "Admin can only review tasks that are ready for review",
        403
      );
    }

    if (newStatus === "CHANGES_REQUESTED" && !comment?.trim()) {
      throw makeError(
        "A review comment is required when requesting changes",
        400
      );
    }
  } else {
    throw makeError("You do not have permission", 403);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE tasks
       SET status = ?,
           review_comment = ?,
           completed_at = CASE
             WHEN ? = 'COMPLETED' THEN CURRENT_TIMESTAMP
             ELSE NULL
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        newStatus,
        ["COMPLETED", "CHANGES_REQUESTED"].includes(newStatus)
          ? comment?.trim() || null
          : null,
        newStatus,
        id,
      ]
    );

    await connection.execute(
      `INSERT INTO task_history
         (task_id, actor_id, old_status, new_status, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [id, user.id, oldStatus, newStatus, comment?.trim() || null]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await pool.execute(
    `SELECT id, engagement_id, title, description,
            created_by, assigned_to, status, review_comment,
            completed_at, created_at, updated_at
     FROM tasks
     WHERE id = ?`,
    [id]
  );

  return rows[0];
}
async function getTaskHistory(id, user) {
  // Reuse existing authorization rules for this task
  await getAuthorizedTask(id, user);

  const [rows] = await pool.execute(
    `SELECT
       th.id,
       th.task_id,
       th.actor_id,
       u.full_name AS actor_name,
       th.old_status,
       th.new_status,
       th.comment,
       th.created_at
     FROM task_history th
     LEFT JOIN users u ON u.id = th.actor_id
     WHERE th.task_id = ?
     ORDER BY th.created_at ASC, th.id ASC`,
    [id]
  );

  return rows;
}
module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  assignTask,
  getTaskHistory,
  updateTaskStatus,
};
