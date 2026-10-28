const express = require("express");
const {
  createServiceType,
  getServiceTypes,
  getServiceTypeById,
  updateServiceType,
  updateServiceTypeStatus,
} = require("../controllers/serviceTypeController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", allowRoles("ADMIN", "MANAGER"), getServiceTypes);
router.get("/:id", allowRoles("ADMIN", "MANAGER"), getServiceTypeById);
router.post("/", allowRoles("ADMIN"), createServiceType);
router.put("/:id", allowRoles("ADMIN"), updateServiceType);
router.patch(
  "/:id/status",
  allowRoles("ADMIN"),
  updateServiceTypeStatus
);

module.exports = router;
