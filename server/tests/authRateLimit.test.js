const express = require("express");
const request = require("supertest");
const { createAuthRateLimiter } = require("../src/middleware/authRateLimit");

describe("authentication rate limiter", () => {
  test("blocks attempts beyond the configured limit per client IP", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.post(
      "/login",
      createAuthRateLimiter({ limit: 2, windowMs: 60_000 }),
      (_req, res) => res.status(200).json({ success: true })
    );

    const sendAttempt = () =>
      request(app)
        .post("/login")
        .set("X-Forwarded-For", "203.0.113.10");

    expect((await sendAttempt()).status).toBe(200);
    expect((await sendAttempt()).status).toBe(200);

    const limitedResponse = await sendAttempt();
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      success: false,
      message: "Too many attempts. Please try again later.",
    });

    const otherClientResponse = await request(app)
      .post("/login")
      .set("X-Forwarded-For", "203.0.113.11");
    expect(otherClientResponse.status).toBe(200);
  });
});
