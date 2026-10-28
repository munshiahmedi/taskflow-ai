const express = require("express");
const {
  createTaskTemplate,
  getTaskTemplates,
  getTaskTemplateById,
  updateTaskTemplate,
  updateTaskTemplateStatus,
} = require("../controllers/taskTemplateController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", allowRoles("ADMIN", "MANAGER"), getTaskTemplates);
router.get("/:id", allowRoles("ADMIN", "MANAGER"), getTaskTemplateById);
router.post("/", allowRoles("ADMIN"), createTaskTemplate);
router.put("/:id", allowRoles("ADMIN"), updateTaskTemplate);
router.patch(
  "/:id/status",
  allowRoles("ADMIN"),
  updateTaskTemplateStatus
);

module.exports = router;
