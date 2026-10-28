const pool = require("../config/db");

async function getDashboard(req, res, next) {
  try {
    let sql = `
      SELECT
        COUNT(*) AS totalTasks,
        COALESCE(SUM(t.status = 'NOT_STARTED'), 0) AS notStartedTasks,
        COALESCE(SUM(t.status = 'IN_PROGRESS'), 0) AS inProgressTasks,
        COALESCE(SUM(t.status = 'WAITING_FOR_CLIENT'), 0) AS waitingForClientTasks,
        COALESCE(SUM(t.status = 'READY_FOR_REVIEW'), 0) AS readyForReviewTasks,
        COALESCE(SUM(t.status = 'CHANGES_REQUESTED'), 0) AS changesRequestedTasks,
        COALESCE(SUM(t.status = 'COMPLETED'), 0) AS completedTasks,
        COALESCE(
          SUM(t.due_date < CURRENT_DATE() AND t.status <> 'COMPLETED'),
          0
        ) AS overdueTasks
      FROM tasks t
      LEFT JOIN engagements e ON e.id = t.engagement_id
    `;
    const params = [];

    if (req.user.role === "MANAGER") {
      sql += " WHERE e.created_by = ?";
      params.push(req.user.id);
    } else if (req.user.role === "TEAM_MEMBER") {
      sql += " WHERE t.assigned_to = ?";
      params.push(req.user.id);
    }

    const [rows] = await pool.execute(sql, params);
    const row = rows[0];
    const statistics = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value)])
    );

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      statistics,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboard };
