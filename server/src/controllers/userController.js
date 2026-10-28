const pool = require("../config/db");

async function getTeamMembers(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name AS fullName, email
       FROM users
       WHERE role = 'TEAM_MEMBER' AND is_active = 1
       ORDER BY full_name ASC`
    );

    const members = rows.map(({ id, fullName, email }) => ({
      id,
      fullName,
      email,
    }));

    return res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getTeamMembers };
