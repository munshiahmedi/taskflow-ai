
const express = require("express");
const {
  createEngagement,
  getEngagements,
} = require("../controllers/engagementController");
const {
  authenticateToken,
} = require("../middleware/authMiddleware");
const {
  allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

// List engagements visible to the authenticated user.
router.get("/", getEngagements);

// Create engagements: Admin and Manager only.
router.post(
  "/",
  allowRoles("ADMIN", "MANAGER"),
  createEngagement
);

module.exports = router;
