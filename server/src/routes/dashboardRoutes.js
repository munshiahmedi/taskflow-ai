const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);
router.get(
  "/",
  allowRoles("ADMIN", "MANAGER", "TEAM_MEMBER"),
  getDashboard
);

module.exports = router;
