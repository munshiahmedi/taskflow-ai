
const express = require("express");
const { register,login } = require("../controllers/authController");
const {
  loginRateLimit,
  registrationRateLimit,
} = require("../middleware/authRateLimit");

const router = express.Router();

router.post("/register", registrationRateLimit, register);
router.post("/login", loginRateLimit, login);

module.exports = router;
