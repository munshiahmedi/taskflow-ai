
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/services/taskService", () => ({
  createTask: jest.fn(),
  getTasks: jest.fn(),
  getTaskById: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  assignTask: jest.fn(),
  updateTaskStatus: jest.fn(),
}));

jest.mock("../src/services/aiDescriptionService", () => ({
  generateTaskDescription: jest.fn(),
}));

const app = require("../src/app");
const taskService = require("../src/services/taskService");
const aiDescriptionService = require("../src/services/aiDescriptionService");

describe("Task API routes", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET =
      originalJwtSecret || "test-only-secret";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  function token(role = "MANAGER") {
    return jwt.sign(
      { id: 10, role },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  }

  test.each(["ADMIN", "MANAGER"])(
    "generates a task description for an authorized %s",
    async (role) => {
      aiDescriptionService.generateTaskDescription.mockResolvedValueOnce(
        "Description\n\nAcceptance criteria:\n- Work is verified"
      );

      const response = await request(app)
        .post("/api/tasks/generate-description")
        .set("Authorization", `Bearer ${token(role)}`)
        .send({
          title: "Prepare monthly report",
          context: "Include required review steps",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        description:
          "Description\n\nAcceptance criteria:\n- Work is verified",
      });
      expect(aiDescriptionService.generateTaskDescription).toHaveBeenCalledWith({
        title: "Prepare monthly report",
        context: "Include required review steps",
      });
      expect(taskService.createTask).not.toHaveBeenCalled();
    }
  );

  test("rejects description generation without authentication", async () => {
    const response = await request(app)
      .post("/api/tasks/generate-description")
      .send({ title: "Prepare monthly report" });

    expect(response.status).toBe(401);
    expect(aiDescriptionService.generateTaskDescription).not.toHaveBeenCalled();
  });

  test("denies TEAM_MEMBER description generation", async () => {
    const response = await request(app)
      .post("/api/tasks/generate-description")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`)
      .send({ title: "Prepare monthly report" });

    expect(response.status).toBe(403);
    expect(aiDescriptionService.generateTaskDescription).not.toHaveBeenCalled();
  });

  test.each([
    [{ title: "  " }, "title is required"],
    [{ title: "t".repeat(256) }, "Title must not exceed 255 characters"],
    [{ title: "Prepare report", context: 7 }, "context must be a string or null"],
    [
      { title: "Prepare report", context: "x".repeat(2001) },
      "context must not exceed 2000 characters",
    ],
  ])("validates description-generation input %p", async (body, message) => {
    const response = await request(app)
      .post("/api/tasks/generate-description")
      .set("Authorization", `Bearer ${token()}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);
    expect(aiDescriptionService.generateTaskDescription).not.toHaveBeenCalled();
  });

  test.each([
    [
      503,
      "Private API configuration diagnostics",
      "AI description generation is not configured.",
    ],
    [502, "Provider returned secret diagnostics", "Unable to generate a task description right now."],
    [
      429,
      "Provider quota details",
      "AI description provider is rate limited. Try again shortly.",
    ],
    [
      504,
      "Private timeout diagnostics",
      "AI description generation timed out. Try again.",
    ],
  ])(
    "returns a safe %i response for AI provider failure",
    async (statusCode, providerMessage, responseMessage) => {
      aiDescriptionService.generateTaskDescription.mockRejectedValueOnce(
        Object.assign(new Error(providerMessage), { statusCode })
      );

      const response = await request(app)
        .post("/api/tasks/generate-description")
        .set("Authorization", `Bearer ${token()}`)
        .send({ title: "Prepare monthly report" });

      expect(response.status).toBe(statusCode);
      expect(response.body).toEqual({
        success: false,
        message: responseMessage,
      });
      expect(response.text).not.toContain(providerMessage);
    }
  );

  test("rejects a request without a token", async () => {
    const response = await request(app).get("/api/tasks");

    expect(response.status).toBe(401);
  });

  test("rejects a request with an invalid token", async () => {
    const response = await request(app)
      .get("/api/tasks")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(taskService.getTasks).not.toHaveBeenCalled();
  });

  test("rejects TEAM_MEMBER when creating a task", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`)
      .send({
        engagementId: 1,
        title: "Prepare report",
      });

    expect(response.status).toBe(403);
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  test("rejects an invalid engagementId", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        engagementId: 0,
        title: "Prepare report",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "engagementId must be a positive integer"
    );
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  test("rejects a blank task title", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        engagementId: 1,
        title: "   ",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("title is required");
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  test("rejects a null task request body", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .send(null);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Request body must be a JSON object"
    );
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  test("rejects malformed JSON request bodies", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  test("creates a valid task", async () => {
    taskService.createTask.mockResolvedValueOnce({
      id: 20,
      engagementId: 1,
      title: "Prepare report",
    });

    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        engagementId: 1,
        title: " Prepare report ",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(taskService.createTask).toHaveBeenCalledWith({
      engagementId: 1,
      title: "Prepare report",
      description: undefined,
      createdBy: 10,
      role: "MANAGER",
    });
  });

  test("rejects a non-numeric task ID", async () => {
    const response = await request(app)
      .get("/api/tasks/abc")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Task ID must be a positive integer"
    );
    expect(taskService.getTaskById).not.toHaveBeenCalled();
  });

  test("rejects an invalid task status", async () => {
    const response = await request(app)
      .patch("/api/tasks/20/status")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`)
      .send({ status: "FINISHED" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid task status");
    expect(taskService.updateTaskStatus).not.toHaveBeenCalled();
  });

  test("rejects TEAM_MEMBER when assigning a task", async () => {
    const response = await request(app)
      .patch("/api/tasks/20/assign")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`)
      .send({ assignedTo: 7 });

    expect(response.status).toBe(403);
    expect(taskService.assignTask).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid task IDs and assignment targets", async () => {
    const invalidIdResponse = await request(app)
      .patch("/api/tasks/abc/assign")
      .set("Authorization", `Bearer ${token()}`)
      .send({ assignedTo: 7 });

    expect(invalidIdResponse.status).toBe(400);
    expect(taskService.assignTask).not.toHaveBeenCalled();

    const invalidTargetResponse = await request(app)
      .patch("/api/tasks/20/assign")
      .set("Authorization", `Bearer ${token()}`)
      .send({ assignedTo: 0 });

    expect(invalidTargetResponse.status).toBe(400);
    expect(taskService.assignTask).not.toHaveBeenCalled();
  });

  test("returns 404 when assignment service rejects an inactive member", async () => {
    taskService.assignTask.mockRejectedValueOnce(
      Object.assign(new Error("Active team member not found"), {
        statusCode: 404,
      })
    );

    const response = await request(app)
      .patch("/api/tasks/20/assign")
      .set("Authorization", `Bearer ${token()}`)
      .send({ assignedTo: 99 });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Active team member not found");
  });

  test("does not expose unexpected task service errors", async () => {
    taskService.getTasks.mockRejectedValueOnce(
      new Error("Sensitive database connection details")
    );

    const response = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${token()}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
    });
    expect(response.body.message).not.toContain(
      "Sensitive database connection details"
    );
  });

  test("rejects a null status request body", async () => {
    const response = await request(app)
      .patch("/api/tasks/20/status")
      .set("Authorization", `Bearer ${token("TEAM_MEMBER")}`)
      .send(null);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Request body must be a JSON object"
    );
    expect(taskService.updateTaskStatus).not.toHaveBeenCalled();
  });
});
