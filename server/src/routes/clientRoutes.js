const express = require("express");
const {
  createClient,
  getClients,
  getClientById,
  updateClient,
  updateClientStatus,
} = require("../controllers/clientController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", allowRoles("ADMIN", "MANAGER"), getClients);
router.get("/:id", allowRoles("ADMIN", "MANAGER"), getClientById);
router.post("/", allowRoles("ADMIN"), createClient);
router.put("/:id", allowRoles("ADMIN"), updateClient);
router.patch("/:id/status", allowRoles("ADMIN"), updateClientStatus);

module.exports = router;
