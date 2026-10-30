const express = require("express");
const {
  getUsers,
  createUser,
  getTeamMembers,
  updateUser,
  updateUserRole,
  updateUserStatus,
} = require("../controllers/userController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", allowRoles("ADMIN"), getUsers);
router.post("/", allowRoles("ADMIN"), createUser);
router.put("/:id", allowRoles("ADMIN"), updateUser);
router.patch("/:id/role", allowRoles("ADMIN"), updateUserRole);
router.patch("/:id/status", allowRoles("ADMIN"), updateUserStatus);
router.get(
  "/team-members",
  allowRoles("ADMIN", "MANAGER"),
  getTeamMembers
);

module.exports = router;
