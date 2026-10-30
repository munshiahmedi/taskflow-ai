const { rateLimit } = require("express-rate-limit");

function createAuthRateLimiter({ limit, windowMs }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, res) {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please try again later.",
      });
    },
  });
}

const loginRateLimit = createAuthRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

const registrationRateLimit = createAuthRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

module.exports = {
  createAuthRateLimiter,
  loginRateLimit,
  registrationRateLimit,
};
