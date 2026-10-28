const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/services/serviceTypeService", () => ({
  getServiceTypes: jest.fn(),
  getServiceTypeById: jest.fn(),
  createServiceType: jest.fn(),
  updateServiceType: jest.fn(),
  updateServiceTypeStatus: jest.fn(),
}));

const app = require("../src/app");
const serviceTypeService = require("../src/services/serviceTypeService");

describe("Service Types API routes", () => {
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

  test("requires a valid JWT", async () => {
    const missing = await request(app).get("/api/service-types");
    const invalid = await request(app)
      .get("/api/service-types")
      .set("Authorization", "Bearer invalid");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(serviceTypeService.getServiceTypes).not.toHaveBeenCalled();
  });

  test("denies TEAM_MEMBER access", async () => {
    const response = await request(app)
      .get("/api/service-types")
      .set(authorized("TEAM_MEMBER"));

    expect(response.status).toBe(403);
    expect(serviceTypeService.getServiceTypes).not.toHaveBeenCalled();
  });

  test("denies TEAM_MEMBER create, update and deactivate operations", async () => {
    const create = await request(app)
      .post("/api/service-types")
      .set(authorized("TEAM_MEMBER"))
      .send({ name: "Tax", engagement_kind: "ONE_TIME" });
    const update = await request(app)
      .put("/api/service-types/1")
      .set(authorized("TEAM_MEMBER"))
      .send({ name: "Updated Tax" });
    const deactivate = await request(app)
      .patch("/api/service-types/1/status")
      .set(authorized("TEAM_MEMBER"))
      .send({ is_active: false });

    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(deactivate.status).toBe(403);
    expect(serviceTypeService.createServiceType).not.toHaveBeenCalled();
    expect(serviceTypeService.updateServiceType).not.toHaveBeenCalled();
    expect(
      serviceTypeService.updateServiceTypeStatus
    ).not.toHaveBeenCalled();
  });

  test("allows MANAGER reads but denies all writes", async () => {
    serviceTypeService.getServiceTypes.mockResolvedValueOnce([]);
    serviceTypeService.getServiceTypeById.mockResolvedValueOnce({
      id: 1,
      name: "Accounting",
    });

    const list = await request(app)
      .get("/api/service-types")
      .set(authorized("MANAGER"));
    const read = await request(app)
      .get("/api/service-types/1")
      .set(authorized("MANAGER"));
    const create = await request(app)
      .post("/api/service-types")
      .set(authorized("MANAGER"))
      .send({ name: "Tax", engagement_kind: "ONE_TIME" });
    const update = await request(app)
      .put("/api/service-types/1")
      .set(authorized("MANAGER"))
      .send({ name: "Tax" });
    const status = await request(app)
      .patch("/api/service-types/1/status")
      .set(authorized("MANAGER"))
      .send({ is_active: false });

    expect(list.status).toBe(200);
    expect(read.status).toBe(200);
    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(status.status).toBe(403);
    expect(serviceTypeService.createServiceType).not.toHaveBeenCalled();
    expect(serviceTypeService.updateServiceType).not.toHaveBeenCalled();
    expect(
      serviceTypeService.updateServiceTypeStatus
    ).not.toHaveBeenCalled();
  });

  test("ADMIN can list, retrieve, create, update and deactivate", async () => {
    const serviceType = {
      id: 1,
      name: "Accounting",
      description: null,
      engagement_kind: "RECURRING",
      recurrence_interval: "MONTHLY",
      is_active: 1,
    };
    serviceTypeService.getServiceTypes.mockResolvedValueOnce([
      serviceType,
    ]);
    serviceTypeService.getServiceTypeById.mockResolvedValueOnce(
      serviceType
    );
    serviceTypeService.createServiceType.mockResolvedValueOnce(
      serviceType
    );
    serviceTypeService.updateServiceType.mockResolvedValueOnce({
      ...serviceType,
      name: "Bookkeeping",
    });
    serviceTypeService.updateServiceTypeStatus.mockResolvedValueOnce({
      ...serviceType,
      is_active: 0,
    });

    const list = await request(app)
      .get("/api/service-types?search=account&active=1")
      .set(authorized());
    const read = await request(app)
      .get("/api/service-types/1")
      .set(authorized());
    const create = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({
        name: " Accounting ",
        engagement_kind: "RECURRING",
        recurrence_interval: "MONTHLY",
      });
    const update = await request(app)
      .put("/api/service-types/1")
      .set(authorized())
      .send({ name: "Bookkeeping" });
    const status = await request(app)
      .patch("/api/service-types/1/status")
      .set(authorized())
      .send({ is_active: false });

    expect(list.status).toBe(200);
    expect(list.body).toEqual({
      success: true,
      count: 1,
      serviceTypes: [serviceType],
    });
    expect(serviceTypeService.getServiceTypes).toHaveBeenCalledWith({
      search: "account",
      isActive: true,
    });
    expect(read.status).toBe(200);
    expect(create.status).toBe(201);
    expect(serviceTypeService.createServiceType).toHaveBeenCalledWith({
      name: "Accounting",
      description: null,
      engagementKind: "RECURRING",
      recurrenceInterval: "MONTHLY",
    });
    expect(update.status).toBe(200);
    expect(serviceTypeService.updateServiceType).toHaveBeenCalledWith(1, {
      name: "Bookkeeping",
    });
    expect(status.status).toBe(200);
    expect(
      serviceTypeService.updateServiceTypeStatus
    ).toHaveBeenCalledWith(1, false);
  });

  test("validates IDs, filters, required values, types and schema limits", async () => {
    const badId = await request(app)
      .get("/api/service-types/0")
      .set(authorized());
    const badSearch = await request(app)
      .get("/api/service-types?search=first&search=second")
      .set(authorized());
    const badActive = await request(app)
      .get("/api/service-types?active=yes")
      .set(authorized());
    const missingName = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({ engagement_kind: "ONE_TIME" });
    const missingKind = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({ name: "Tax" });
    const tooLongName = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({ name: "n".repeat(151), engagement_kind: "ONE_TIME" });
    const badDescription = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({
        name: "Tax",
        description: 123,
        engagement_kind: "ONE_TIME",
      });
    const tooLongDescription = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({
        name: "Tax",
        description: "é".repeat(32768),
        engagement_kind: "ONE_TIME",
      });
    const badKind = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({ name: "Tax", engagement_kind: "OTHER" });
    const badInterval = await request(app)
      .post("/api/service-types")
      .set(authorized())
      .send({
        name: "Tax",
        engagement_kind: "RECURRING",
        recurrence_interval: "WEEKLY",
      });
    const emptyUpdate = await request(app)
      .put("/api/service-types/1")
      .set(authorized())
      .send({});
    const badUpdateId = await request(app)
      .put("/api/service-types/nope")
      .set(authorized())
      .send({ name: "Tax" });
    const badStatus = await request(app)
      .patch("/api/service-types/1/status")
      .set(authorized())
      .send({ is_active: "true" });

    for (const response of [
      badId,
      badSearch,
      badActive,
      missingName,
      missingKind,
      tooLongName,
      badDescription,
      tooLongDescription,
      badKind,
      badInterval,
      emptyUpdate,
      badUpdateId,
      badStatus,
    ]) {
      expect(response.status).toBe(400);
    }

    expect(serviceTypeService.createServiceType).not.toHaveBeenCalled();
    expect(serviceTypeService.updateServiceType).not.toHaveBeenCalled();
  });

  test("returns service and database errors through error middleware", async () => {
    serviceTypeService.getServiceTypeById.mockRejectedValueOnce(
      Object.assign(new Error("Service type not found"), {
        statusCode: 404,
      })
    );

    const missing = await request(app)
      .get("/api/service-types/999")
      .set(authorized());

    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Service type not found");

    serviceTypeService.getServiceTypes.mockRejectedValueOnce(
      new Error("Sensitive database details")
    );

    const failed = await request(app)
      .get("/api/service-types")
      .set(authorized());

    expect(failed.status).toBe(500);
    expect(failed.body.message).toBe("Internal server error");
    expect(failed.body.message).not.toContain(
      "Sensitive database details"
    );
  });
});
