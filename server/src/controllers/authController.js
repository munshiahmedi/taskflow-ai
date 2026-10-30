
const authService = require("../services/authService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function logAuthError(action, error, req) {
  const sensitiveValues = [
    req.body?.password,
    req.body?.email,
    req.get("authorization"),
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    process.env.JWT_SECRET,
    process.env.GROQ_API_KEY,
  ].filter((value) => typeof value === "string" && value.length > 0);

  const redact = (value) =>
    sensitiveValues.reduce(
      (sanitized, secret) =>
        sanitized.split(secret).join("[REDACTED]"),
      value
    );

  if (!(error instanceof Error)) {
    console.error(`${action} failed`, { errorType: typeof error });
    return;
  }

  const details = {
    name: error.name,
    message: redact(error.message),
  };

  for (const key of ["code", "errno", "sqlState"]) {
    const value = error[key];

    if (typeof value === "string" || typeof value === "number") {
      details[key] = value;
    }
  }

  if (error.stack) {
    details.stack = redact(error.stack);
  }

  console.error(`${action} failed`, details);
}

// Register a new user
async function register(req, res) {
  try {
    const { fullName, email, password } = req.body || {};

    // Validate full name
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

    // Validate email
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    // Validate password
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and at most 72 UTF-8 bytes",
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
    if (!error?.statusCode || error.statusCode >= 500) {
      logAuthError("Registration", error, req);
    }

    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// Login an existing user
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    // Validate email
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    // Validate password
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
    if (!error?.statusCode || error.statusCode >= 500) {
      logAuthError("Login", error, req);
    }

    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

module.exports = { register, login };
