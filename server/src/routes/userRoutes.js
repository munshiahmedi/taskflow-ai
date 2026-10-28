const express = require("express");
const { getTeamMembers } = require("../controllers/userController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get(
  "/team-members",
  allowRoles("ADMIN", "MANAGER"),
  getTeamMembers
);

module.exports = router;
