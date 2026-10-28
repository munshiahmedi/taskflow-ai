
const express = require("express");

const {
  generateTaskDescription,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  assignTask,
  updateTaskStatus,
} = require("../controllers/taskController");
const { allowRoles } = require("../middleware/roleMiddleware");

const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// All task routes require a valid JWT token
router.use(authenticateToken);

router.post(
  "/generate-description",
  allowRoles("ADMIN", "MANAGER"),
  generateTaskDescription
);
router.post("/", allowRoles("ADMIN", "MANAGER"), createTask);
router.get("/", allowRoles("ADMIN", "MANAGER", "TEAM_MEMBER"), getTasks);
router.get("/:id", allowRoles("ADMIN", "MANAGER", "TEAM_MEMBER"), getTaskById);
router.patch("/:id", allowRoles("ADMIN", "MANAGER"), updateTask);
router.delete("/:id", allowRoles("ADMIN", "MANAGER"), deleteTask);
router.patch(
  "/:id/assign",
  allowRoles("ADMIN", "MANAGER"),
  assignTask
);
router.patch(
  "/:id/status",
  allowRoles("ADMIN", "MANAGER", "TEAM_MEMBER"),
  updateTaskStatus
);

module.exports = router;
