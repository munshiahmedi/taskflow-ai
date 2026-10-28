
const authService = require("../services/authService");

async function register(req, res) {
  try {
    const { fullName, email, password } = req.body || {};

    if (
      typeof fullName !== "string" ||
      !fullName.trim() ||
      fullName.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Name is required and must not exceed 100 characters",
      });
    }

    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and at most 72 UTF-8 bytes",
      });
    }

    const user = await authService.registerUser({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user,
    });
  } catch (error) {
    console.error("Registration failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const result = await authService.loginUser({
      email: email.trim().toLowerCase(),
      password,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

module.exports = { register, login };


