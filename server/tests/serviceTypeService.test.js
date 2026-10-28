jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
}));

const pool = require("../src/config/db");
const serviceTypeService = require("../src/services/serviceTypeService");

describe("serviceTypeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("lists service types with parameterized search and active filters", async () => {
    const injectionLikeSearch = "' OR 1=1 --";
    pool.execute.mockResolvedValueOnce([[]]);

    await serviceTypeService.getServiceTypes({
      search: injectionLikeSearch,
      isActive: false,
    });

    const [query, params] = pool.execute.mock.calls[0];
    expect(query).toContain("(name LIKE ? OR description LIKE ?)");
    expect(query).toContain("is_active = ?");
    expect(query).not.toContain(injectionLikeSearch);
    expect(params).toEqual([
      `%${injectionLikeSearch}%`,
      `%${injectionLikeSearch}%`,
      0,
    ]);
  });

  test("retrieves a service type by ID", async () => {
    const serviceType = { id: 2, name: "Accounting" };
    pool.execute.mockResolvedValueOnce([[serviceType]]);

    await expect(
      serviceTypeService.getServiceTypeById(2)
    ).resolves.toEqual(serviceType);
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [2]
    );
  });

  test("returns 404 for a missing service type", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      serviceTypeService.getServiceTypeById(88)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Service type not found",
    });
  });

  test("creates a service type with parameterized values and returns it", async () => {
    const serviceType = {
      id: 4,
      name: "Tax",
      description: null,
      engagement_kind: "RECURRING",
      recurrence_interval: "YEARLY",
    };
    pool.execute
      .mockResolvedValueOnce([{ insertId: 4 }])
      .mockResolvedValueOnce([[serviceType]]);

    const result = await serviceTypeService.createServiceType({
      name: "Tax",
      description: null,
      engagementKind: "RECURRING",
      recurrenceInterval: "YEARLY",
    });

    expect(pool.execute.mock.calls[0][0]).toContain(
      "INSERT INTO service_types"
    );
    expect(pool.execute.mock.calls[0][1]).toEqual([
      "Tax",
      null,
      "RECURRING",
      "YEARLY",
    ]);
    expect(result).toEqual(serviceType);
  });

  test("maps duplicate service type names to 409", async () => {
    const duplicateError = new Error("Duplicate entry");
    duplicateError.code = "ER_DUP_ENTRY";
    pool.execute.mockRejectedValueOnce(duplicateError);

    await expect(
      serviceTypeService.createServiceType({
        name: "Tax",
        description: null,
        engagementKind: "ONE_TIME",
        recurrenceInterval: null,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "A service type with this name already exists",
    });
  });

  test("updates supported fields using parameterized values", async () => {
    const serviceType = { id: 6, name: "Updated" };
    pool.execute
      .mockResolvedValueOnce([[{ id: 6 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[serviceType]]);

    const result = await serviceTypeService.updateServiceType(6, {
      name: "Updated",
      description: "Updated description",
      engagementKind: "ONE_TIME",
      recurrenceInterval: null,
    });

    const [query, params] = pool.execute.mock.calls[1];
    expect(query).toContain("name = ?");
    expect(query).toContain("description = ?");
    expect(query).toContain("engagement_kind = ?");
    expect(query).toContain("recurrence_interval = ?");
    expect(params).toEqual([
      "Updated",
      "Updated description",
      "ONE_TIME",
      null,
      6,
    ]);
    expect(result).toEqual(serviceType);
  });

  test("returns 404 when updating a missing service type", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      serviceTypeService.updateServiceType(77, { name: "Tax" })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("updates active status without deleting related records", async () => {
    const serviceType = { id: 3, is_active: 0 };
    pool.execute
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[serviceType]]);

    await expect(
      serviceTypeService.updateServiceTypeStatus(3, false)
    ).resolves.toEqual(serviceType);

    expect(pool.execute.mock.calls[1][0]).toContain(
      "UPDATE service_types"
    );
    expect(pool.execute.mock.calls[1][0]).toContain("SET is_active = ?");
    expect(pool.execute.mock.calls[1][1]).toEqual([0, 3]);
  });

  test("propagates unexpected database errors", async () => {
    const databaseError = new Error("Connection failed");
    pool.execute.mockRejectedValueOnce(databaseError);

    await expect(
      serviceTypeService.getServiceTypes({})
    ).rejects.toBe(databaseError);
  });
});
