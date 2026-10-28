const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/services/taskTemplateService", () => ({
  getTaskTemplates: jest.fn(),
  getTaskTemplateById: jest.fn(),
  createTaskTemplate: jest.fn(),
  updateTaskTemplate: jest.fn(),
  updateTaskTemplateStatus: jest.fn(),
}));

const app = require("../src/app");
const taskTemplateService = require("../src/services/taskTemplateService");

describe("Task Templates API routes", () => {
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

  function token(role = "ADMIN") {
    return jwt.sign(
      { id: 10, role },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  }

  function authorized(role = "ADMIN") {
    return { Authorization: `Bearer ${token(role)}` };
  }

  test("requires a valid JWT and denies TEAM_MEMBER", async () => {
    const missing = await request(app).get("/api/task-templates");
    const invalid = await request(app)
      .get("/api/task-templates")
      .set("Authorization", "Bearer invalid");
    const forbidden = await request(app)
      .get("/api/task-templates")
      .set(authorized("TEAM_MEMBER"));

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(taskTemplateService.getTaskTemplates).not.toHaveBeenCalled();
  });

  test("denies TEAM_MEMBER create, update and deactivate operations", async () => {
    const create = await request(app)
      .post("/api/task-templates")
      .set(authorized("TEAM_MEMBER"))
      .send({ service_type_id: 2, name: "Monthly" });
    const update = await request(app)
      .put("/api/task-templates/1")
      .set(authorized("TEAM_MEMBER"))
      .send({ name: "Updated monthly template" });
    const deactivate = await request(app)
      .patch("/api/task-templates/1/status")
      .set(authorized("TEAM_MEMBER"))
      .send({ is_active: false });

    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(deactivate.status).toBe(403);
    expect(taskTemplateService.createTaskTemplate).not.toHaveBeenCalled();
    expect(taskTemplateService.updateTaskTemplate).not.toHaveBeenCalled();
    expect(
      taskTemplateService.updateTaskTemplateStatus
    ).not.toHaveBeenCalled();
  });

  test("allows MANAGER reads but denies modifications", async () => {
    taskTemplateService.getTaskTemplates.mockResolvedValueOnce([]);
    taskTemplateService.getTaskTemplateById.mockResolvedValueOnce({
      id: 1,
      items: [],
    });

    const list = await request(app)
      .get("/api/task-templates")
      .set(authorized("MANAGER"));
    const read = await request(app)
      .get("/api/task-templates/1")
      .set(authorized("MANAGER"));
    const create = await request(app)
      .post("/api/task-templates")
      .set(authorized("MANAGER"))
      .send({ service_type_id: 2, name: "Monthly" });
    const update = await request(app)
      .put("/api/task-templates/1")
      .set(authorized("MANAGER"))
      .send({ name: "Updated" });
    const status = await request(app)
      .patch("/api/task-templates/1/status")
      .set(authorized("MANAGER"))
      .send({ is_active: false });

    expect(list.status).toBe(200);
    expect(read.status).toBe(200);
    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(status.status).toBe(403);
    expect(taskTemplateService.createTaskTemplate).not.toHaveBeenCalled();
    expect(taskTemplateService.updateTaskTemplate).not.toHaveBeenCalled();
    expect(
      taskTemplateService.updateTaskTemplateStatus
    ).not.toHaveBeenCalled();
  });

  test("ADMIN can list, retrieve items, create, update and deactivate", async () => {
    const template = {
      id: 8,
      service_type_id: 3,
      name: "Monthly",
      version: 1,
      is_active: 1,
      items: [
        {
          id: 21,
          title: "Prepare report",
          sequence_no: 1,
          due_days_after_start: 5,
        },
      ],
    };
    taskTemplateService.getTaskTemplates.mockResolvedValueOnce([template]);
    taskTemplateService.getTaskTemplateById.mockResolvedValueOnce(
      template
    );
    taskTemplateService.createTaskTemplate.mockResolvedValueOnce(
      template
    );
    taskTemplateService.updateTaskTemplate.mockResolvedValueOnce(
      template
    );
    taskTemplateService.updateTaskTemplateStatus.mockResolvedValueOnce({
      ...template,
      is_active: 0,
    });

    const list = await request(app)
      .get("/api/task-templates?service_type_id=3&active=1")
      .set(authorized());
    const read = await request(app)
      .get("/api/task-templates/8")
      .set(authorized());
    const create = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({
        service_type_id: 3,
        name: " Monthly ",
        items: [
          {
            title: " Prepare report ",
            sequence_no: 1,
            due_days_after_start: 5,
          },
        ],
      });
    const update = await request(app)
      .put("/api/task-templates/8")
      .set(authorized())
      .send({
        name: "Monthly",
        items: [
          {
            id: 21,
            title: "Prepare report",
            sequence_no: 1,
            due_days_after_start: 5,
          },
        ],
      });
    const status = await request(app)
      .patch("/api/task-templates/8/status")
      .set(authorized())
      .send({ is_active: false });

    expect(list.status).toBe(200);
    expect(taskTemplateService.getTaskTemplates).toHaveBeenCalledWith({
      serviceTypeId: 3,
      isActive: true,
    });
    expect(read.status).toBe(200);
    expect(read.body.taskTemplate.items).toHaveLength(1);
    expect(create.status).toBe(201);
    expect(taskTemplateService.createTaskTemplate).toHaveBeenCalledWith({
      serviceTypeId: 3,
      name: "Monthly",
      version: 1,
      items: [
        {
          title: " Prepare report ",
          sequence_no: 1,
          due_days_after_start: 5,
        },
      ],
    });
    expect(update.status).toBe(200);
    expect(taskTemplateService.updateTaskTemplate).toHaveBeenCalledWith(
      8,
      {
        name: "Monthly",
        items: [
          {
            id: 21,
            title: "Prepare report",
            sequence_no: 1,
            due_days_after_start: 5,
          },
        ],
      }
    );
    expect(status.status).toBe(200);
    expect(
      taskTemplateService.updateTaskTemplateStatus
    ).toHaveBeenCalledWith(8, false);
  });

  test("validates IDs, filters, template fields and child item constraints", async () => {
    const badId = await request(app)
      .get("/api/task-templates/0")
      .set(authorized());
    const badFilter = await request(app)
      .get("/api/task-templates?service_type_id=0")
      .set(authorized());
    const badActive = await request(app)
      .get("/api/task-templates?active=yes")
      .set(authorized());
    const missingService = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({ name: "Monthly" });
    const missingName = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({ service_type_id: 3 });
    const badServiceType = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({ service_type_id: "3", name: "Monthly" });
    const tooLongName = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({ service_type_id: 3, name: "n".repeat(151) });
    const badVersion = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({ service_type_id: 3, name: "Monthly", version: 0 });
    const badTitle = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({
        service_type_id: 3,
        name: "Monthly",
        items: [
          {
            title: "",
            sequence_no: 1,
            due_days_after_start: 0,
          },
        ],
      });
    const duplicateSequence = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({
        service_type_id: 3,
        name: "Monthly",
        items: [
          {
            title: "First",
            sequence_no: 1,
            due_days_after_start: 0,
          },
          {
            title: "Second",
            sequence_no: 1,
            due_days_after_start: 0,
          },
        ],
      });
    const itemIdOnCreate = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({
        service_type_id: 3,
        name: "Monthly",
        items: [
          {
            id: 1,
            title: "Task",
            sequence_no: 1,
            due_days_after_start: 0,
          },
        ],
      });
    const badDueDays = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({
        service_type_id: 3,
        name: "Monthly",
        items: [
          {
            title: "Task",
            sequence_no: 1,
            due_days_after_start: -1,
          },
        ],
      });
    const emptyUpdate = await request(app)
      .put("/api/task-templates/8")
      .set(authorized())
      .send({});
    const badStatus = await request(app)
      .patch("/api/task-templates/8/status")
      .set(authorized())
      .send({ is_active: "true" });

    for (const response of [
      badId,
      badFilter,
      badActive,
      missingService,
      missingName,
      badServiceType,
      tooLongName,
      badVersion,
      badTitle,
      duplicateSequence,
      itemIdOnCreate,
      badDueDays,
      emptyUpdate,
      badStatus,
    ]) {
      expect(response.status).toBe(400);
    }

    expect(taskTemplateService.createTaskTemplate).not.toHaveBeenCalled();
    expect(taskTemplateService.updateTaskTemplate).not.toHaveBeenCalled();
  });

  test("returns not-found and sanitized unexpected errors", async () => {
    taskTemplateService.getTaskTemplateById.mockRejectedValueOnce(
      Object.assign(new Error("Task template not found"), {
        statusCode: 404,
      })
    );
    const missing = await request(app)
      .get("/api/task-templates/999")
      .set(authorized());

    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Task template not found");

    taskTemplateService.getTaskTemplates.mockRejectedValueOnce(
      new Error("Sensitive database details")
    );
    const failed = await request(app)
      .get("/api/task-templates")
      .set(authorized());

    expect(failed.status).toBe(500);
    expect(failed.body.message).toBe("Internal server error");
    expect(failed.body.message).not.toContain(
      "Sensitive database details"
    );
  });

  test("surfaces invalid service-type references from the service", async () => {
    taskTemplateService.createTaskTemplate.mockRejectedValueOnce(
      Object.assign(
        new Error("Service type not found or inactive"),
        { statusCode: 404 }
      )
    );

    const response = await request(app)
      .post("/api/task-templates")
      .set(authorized())
      .send({ service_type_id: 99, name: "Monthly" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      "Service type not found or inactive"
    );
  });
});
