const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/services/clientService", () => ({
  getClients: jest.fn(),
  getClientById: jest.fn(),
  createClient: jest.fn(),
  updateClient: jest.fn(),
  updateClientStatus: jest.fn(),
}));

const app = require("../src/app");
const clientService = require("../src/services/clientService");

describe("Clients API routes", () => {
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

  test("requires a valid authentication token", async () => {
    const missing = await request(app).get("/api/clients");
    const invalid = await request(app)
      .get("/api/clients")
      .set("Authorization", "Bearer invalid-token");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(clientService.getClients).not.toHaveBeenCalled();
  });

  test("denies TEAM_MEMBER access", async () => {
    const response = await request(app)
      .get("/api/clients")
      .set(authorized("TEAM_MEMBER"));

    expect(response.status).toBe(403);
    expect(clientService.getClients).not.toHaveBeenCalled();
  });

  test("allows MANAGER read-only access", async () => {
    clientService.getClients.mockResolvedValueOnce([]);
    clientService.getClientById.mockResolvedValueOnce({
      id: 1,
      name: "Acme",
    });

    const list = await request(app)
      .get("/api/clients")
      .set(authorized("MANAGER"));
    const read = await request(app)
      .get("/api/clients/1")
      .set(authorized("MANAGER"));
    const create = await request(app)
      .post("/api/clients")
      .set(authorized("MANAGER"))
      .send({ name: "Acme" });
    const update = await request(app)
      .put("/api/clients/1")
      .set(authorized("MANAGER"))
      .send({ name: "Updated Acme" });
    const status = await request(app)
      .patch("/api/clients/1/status")
      .set(authorized("MANAGER"))
      .send({ is_active: false });

    expect(list.status).toBe(200);
    expect(read.status).toBe(200);
    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
    expect(status.status).toBe(403);
    expect(clientService.createClient).not.toHaveBeenCalled();
    expect(clientService.updateClient).not.toHaveBeenCalled();
    expect(clientService.updateClientStatus).not.toHaveBeenCalled();
  });

  test("ADMIN can create, list, read, update, and change status", async () => {
    const client = {
      id: 1,
      name: "Acme",
      email: null,
      phone: null,
      is_active: 1,
    };
    clientService.createClient.mockResolvedValueOnce(client);
    clientService.getClients.mockResolvedValueOnce([client]);
    clientService.getClientById.mockResolvedValueOnce(client);
    clientService.updateClient.mockResolvedValueOnce({
      ...client,
      name: "Updated Acme",
    });
    clientService.updateClientStatus.mockResolvedValueOnce({
      ...client,
      is_active: 0,
    });

    const create = await request(app)
      .post("/api/clients")
      .set(authorized())
      .send({ name: " Acme ", email: "", phone: " " });
    const list = await request(app)
      .get("/api/clients?search=Acme&active=1")
      .set(authorized());
    const read = await request(app)
      .get("/api/clients/1")
      .set(authorized());
    const update = await request(app)
      .put("/api/clients/1")
      .set(authorized())
      .send({ name: "Updated Acme" });
    const status = await request(app)
      .patch("/api/clients/1/status")
      .set(authorized())
      .send({ is_active: false });

    expect(create.status).toBe(201);
    expect(create.body.client).toEqual(client);
    expect(clientService.createClient).toHaveBeenCalledWith({
      name: "Acme",
      email: null,
      phone: null,
    });
    expect(list.status).toBe(200);
    expect(clientService.getClients).toHaveBeenCalledWith({
      search: "Acme",
      isActive: true,
    });
    expect(read.status).toBe(200);
    expect(update.status).toBe(200);
    expect(clientService.updateClient).toHaveBeenCalledWith(1, {
      name: "Updated Acme",
    });
    expect(status.status).toBe(200);
    expect(clientService.updateClientStatus).toHaveBeenCalledWith(
      1,
      false
    );
  });

  test("validates required name, email, list filters, status, and ID", async () => {
    const noName = await request(app)
      .post("/api/clients")
      .set(authorized())
      .send({ name: " " });
    const badEmail = await request(app)
      .post("/api/clients")
      .set(authorized())
      .send({ name: "Acme", email: "not-an-email" });
    const badEmailType = await request(app)
      .post("/api/clients")
      .set(authorized())
      .send({ name: "Acme", email: 123 });
    const badPhone = await request(app)
      .post("/api/clients")
      .set(authorized())
      .send({ name: "Acme", phone: 123 });
    const badUpdateEmailType = await request(app)
      .put("/api/clients/1")
      .set(authorized())
      .send({ email: 123 });
    const badUpdatePhoneType = await request(app)
      .put("/api/clients/1")
      .set(authorized())
      .send({ phone: 123 });
    const badSearch = await request(app)
      .get("/api/clients?search=first&search=second")
      .set(authorized());
    const badActive = await request(app)
      .get("/api/clients?active=yes")
      .set(authorized());
    const badId = await request(app)
      .get("/api/clients/0")
      .set(authorized());
    const badStatus = await request(app)
      .patch("/api/clients/1/status")
      .set(authorized())
      .send({ is_active: "true" });

    expect(noName.status).toBe(400);
    expect(badEmail.status).toBe(400);
    expect(badEmailType.status).toBe(400);
    expect(badPhone.status).toBe(400);
    expect(badUpdateEmailType.status).toBe(400);
    expect(badUpdatePhoneType.status).toBe(400);
    expect(badSearch.status).toBe(400);
    expect(badActive.status).toBe(400);
    expect(badId.status).toBe(400);
    expect(badStatus.status).toBe(400);
    expect(clientService.createClient).not.toHaveBeenCalled();
    expect(clientService.updateClient).not.toHaveBeenCalled();
    expect(clientService.getClientById).not.toHaveBeenCalled();
  });

  test("returns 404 when a client does not exist", async () => {
    clientService.getClientById.mockRejectedValueOnce(
      Object.assign(new Error("Client not found"), { statusCode: 404 })
    );

    const response = await request(app)
      .get("/api/clients/999")
      .set(authorized());

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Client not found");
  });

  test("does not expose unexpected database errors", async () => {
    clientService.getClients.mockRejectedValueOnce(
      new Error("Sensitive database details")
    );

    const response = await request(app)
      .get("/api/clients")
      .set(authorized());

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
    expect(response.body.message).not.toContain(
      "Sensitive database details"
    );
  });
});
