
jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
  getConnection: jest.fn(),
}));

const pool = require("../src/config/db");
const engagementService = require("../src/services/engagementService");

describe("Recurring engagement validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Engagement access scope", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("limits a manager's engagements to those they created", async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      await engagementService.getEngagements({
        id: 3,
        role: "MANAGER",
      });

      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining("WHERE e.created_by = ?"),
        [3]
      );
    });

    test("does not apply manager scoping to admins", async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      await engagementService.getEngagements({
        id: 1,
        role: "ADMIN",
      });

      const [query, params] = pool.execute.mock.calls[0];
      expect(query).not.toContain("WHERE e.created_by = ?");
      expect(params).toEqual([]);
    });
  });

  test("should reject a duplicate recurring engagement", async () => {
    const duplicateError = new Error(
      "Duplicate entry for recurring engagement"
    );
    duplicateError.code = "ER_DUP_ENTRY";

    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 2,
            engagement_kind: "RECURRING",
            recurrence_interval: "MONTHLY",
          },
        ],
      ])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            title: "Prepare monthly report",
            description: "Prepare the monthly report",
            due_days_after_start: 5,
          },
        ],
      ]);

    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn().mockRejectedValue(duplicateError),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: 2,
          templateId: 2,
          name: "Monthly Test Engagement November 2026",
          engagementKind: "RECURRING",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test("should reject a zero client ID", async () => {
    await expect(
      engagementService.createEngagement(
        {
          clientId: 0,
          serviceTypeId: 2,
          templateId: 2,
          name: "Test Engagement",
          engagementKind: "RECURRING",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("should reject a negative service type ID", async () => {
    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: -2,
          templateId: 2,
          name: "Test Engagement",
          engagementKind: "RECURRING",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("should reject an empty engagement name", async () => {
    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: 2,
          templateId: 2,
          name: "   ",
          engagementKind: "RECURRING",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Valid positive clientId, serviceTypeId, templateId and name are required",
    });

    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("should reject an engagement name longer than 200 characters", async () => {
    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: 2,
          templateId: 2,
          name: "N".repeat(201),
          engagementKind: "RECURRING",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Engagement name must not exceed 200 characters",
    });

    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("should reject an impossible calendar date", async () => {
    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: 2,
          templateId: 2,
          name: "Test Engagement",
          engagementKind: "RECURRING",
          periodStart: "2026-02-31",
          periodEnd: "2026-03-31",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("should reject a period ending before it starts", async () => {
    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: 2,
          templateId: 2,
          name: "Test Engagement",
          engagementKind: "RECURRING",
          periodStart: "2026-11-30",
          periodEnd: "2026-11-01",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("should accept a 200-character engagement name and generate tasks", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 2,
            engagement_kind: "RECURRING",
            recurrence_interval: "MONTHLY",
          },
        ],
      ])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            title: "Prepare monthly report",
            description: "Prepare the report",
            due_days_after_start: 5,
          },
          {
            id: 11,
            title: "Review monthly report",
            description: "Review the report",
            due_days_after_start: 10,
          },
        ],
      ]);

    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest
        .fn()
        .mockResolvedValueOnce([{ insertId: 100 }])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    const name = "N".repeat(200);
    const result = await engagementService.createEngagement(
      {
        clientId: 1,
        serviceTypeId: 2,
        templateId: 2,
        name,
        engagementKind: "RECURRING",
        periodStart: "2026-11-01",
        periodEnd: "2026-11-30",
      },
      { id: 3, role: "MANAGER" }
    );

    expect(result).toMatchObject({
      id: 100,
      client_id: 1,
      service_type_id: 2,
      template_id: 2,
      name,
      engagement_kind: "RECURRING",
      recurrence_period_key: "2026-11",
      generated_task_count: 2,
    });

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledTimes(3);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);

    expect(connection.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO tasks"),
      [100, 10, "Prepare monthly report", "Prepare the report", 3, "2026-11-06"]
    );

    expect(connection.execute).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO tasks"),
      [100, 11, "Review monthly report", "Review the report", 3, "2026-11-11"]
    );
  });
    test("should rollback engagement and tasks if a task insert fails", async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 2,
          engagement_kind: "RECURRING",
          recurrence_interval: "MONTHLY",
        },
      ]])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([[
        {
          id: 10,
          title: "First task",
          description: "First task description",
          due_days_after_start: 5,
        },
        {
          id: 11,
          title: "Second task",
          description: "Second task description",
          due_days_after_start: 10,
        },
      ]]);

    const taskInsertError = new Error("Simulated task insert failure");

    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn()
        .mockResolvedValueOnce([{ insertId: 200 }])
        .mockResolvedValueOnce([{}])
        .mockRejectedValueOnce(taskInsertError),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValueOnce(connection);

    await expect(
      engagementService.createEngagement(
        {
          clientId: 1,
          serviceTypeId: 2,
          templateId: 2,
          name: "Rollback Test Engagement",
          engagementKind: "RECURRING",
          periodStart: "2026-12-01",
          periodEnd: "2026-12-31",
        },
        { id: 3, role: "MANAGER" }
      )
    ).rejects.toThrow("Simulated task insert failure");

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledTimes(3);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });
});
