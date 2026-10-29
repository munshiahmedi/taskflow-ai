
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const app = express();
app.use(cors());
app.use(express.json());

const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const engagementRoutes = require("./routes/engagementRoutes");
const clientRoutes = require("./routes/clientRoutes");
const serviceTypeRoutes = require("./routes/serviceTypeRoutes");
const taskTemplateRoutes = require("./routes/taskTemplateRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const { allowRoles } = require("./middleware/roleMiddleware");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorMiddleware");


app.get("/api/auth/me", authenticateToken, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name, email, role, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: "User account not found or inactive",
      });
    }

    const user = {
      id: rows[0].id,
      fullName: rows[0].full_name,
      email: rows[0].email,
      role: rows[0].role,
    };

    return res.status(200).json({
      success: true,
      message: "Authenticated user retrieved successfully",
      user,
    });
  } catch (error) {
    return next(error);
  }
});
app.get(
  "/api/auth/admin-test",
  authenticateToken,
  allowRoles("ADMIN"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access granted",
      user: req.user,
    });
  }
);


// 1. Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "TaskFlow AI API is running",
  });
});

// 2. Database health check
app.get("/api/health/db", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS database_name"
    );

    res.status(200).json({
      success: true,
      message: "Database connection successful",
      database: rows[0].database_name,
    });
  } catch (error) {
    console.error(
      "Database health check failed",
      {
        code: error.code || "UNKNOWN",
        message: error.message,
      }
    );

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// 3. API routes — register BEFORE error middleware
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/engagements", engagementRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/service-types", serviceTypeRoutes);
app.use("/api/task-templates", taskTemplateRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

// 4. Error middleware — always last
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
