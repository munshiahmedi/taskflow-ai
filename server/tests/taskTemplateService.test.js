jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
  getConnection: jest.fn(),
}));

const pool = require("../src/config/db");
const taskTemplateService = require("../src/services/taskTemplateService");

describe("taskTemplateService", () => {
  let connection;

  beforeEach(() => {
    jest.clearAllMocks();
    connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    pool.getConnection.mockResolvedValue(connection);
  });

  test("lists templates with parameterized service and active filters", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await taskTemplateService.getTaskTemplates({
      serviceTypeId: 7,
      isActive: false,
    });

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining(
        "WHERE service_type_id = ? AND is_active = ?"
      ),
      [7, 0]
    );
  });

  test("retrieves a template and its items in task-generation order", async () => {
    const template = { id: 8, service_type_id: 3, name: "Monthly" };
    const items = [
      { id: 21, sequence_no: 1, title: "First" },
      { id: 22, sequence_no: 2, title: "Second" },
    ];
    pool.execute
      .mockResolvedValueOnce([[template]])
      .mockResolvedValueOnce([items]);

    await expect(
      taskTemplateService.getTaskTemplateById(8)
    ).resolves.toEqual({ ...template, items });
    expect(pool.execute.mock.calls[1][0]).toContain(
      "ORDER BY sequence_no ASC, id ASC"
    );
    expect(pool.execute.mock.calls[1][1]).toEqual([8]);
  });

  test("returns 404 when a template is missing", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      taskTemplateService.getTaskTemplateById(99)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Task template not found",
    });
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("creates template and items atomically and retrieves the result", async () => {
    connection.execute
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    pool.execute
      .mockResolvedValueOnce([
        [{ id: 8, service_type_id: 3, name: "Monthly" }],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 21,
            template_id: 8,
            title: "Prepare report",
            sequence_no: 1,
          },
        ],
      ]);

    const result = await taskTemplateService.createTaskTemplate({
      serviceTypeId: 3,
      name: "Monthly",
      version: 1,
      items: [
        {
          title: "Prepare report",
          description: null,
          sequence_no: 1,
          due_days_after_start: 5,
        },
        {
          title: "Review report",
          description: "Check report",
          sequence_no: 2,
          due_days_after_start: 10,
        },
      ],
    });

    expect(connection.execute.mock.calls[0]).toEqual([
      "SELECT id FROM service_types WHERE id = ? AND is_active = 1",
      [3],
    ]);
    expect(connection.execute.mock.calls[1][0]).toContain(
      "INSERT INTO task_templates"
    );
    expect(connection.execute.mock.calls[2][0]).toContain(
      "INSERT INTO task_template_items"
    );
    expect(connection.execute.mock.calls[2][1]).toEqual([
      8,
      "Prepare report",
      null,
      1,
      5,
    ]);
    expect(connection.execute.mock.calls[3][1]).toEqual([
      8,
      "Review report",
      "Check report",
      2,
      10,
    ]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(result.items[0].title).toBe("Prepare report");
  });

  test("rejects a missing or inactive service type", async () => {
    connection.execute.mockResolvedValueOnce([[]]);

    await expect(
      taskTemplateService.createTaskTemplate({
        serviceTypeId: 33,
        name: "Monthly",
        version: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Service type not found or inactive",
    });
    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test("rolls template and item creation back when an item insert fails", async () => {
    const itemError = new Error("Item insert failed");
    connection.execute
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockRejectedValueOnce(itemError);

    await expect(
      taskTemplateService.createTaskTemplate({
        serviceTypeId: 3,
        name: "Monthly",
        version: 1,
        items: [
          {
            title: "Prepare report",
            sequence_no: 1,
            due_days_after_start: 0,
          },
        ],
      })
    ).rejects.toBe(itemError);

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test("updates template fields and preserves its child items", async () => {
    connection.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([{}]);
    pool.execute
      .mockResolvedValueOnce([
        [{ id: 8, service_type_id: 3, name: "Updated" }],
      ])
      .mockResolvedValueOnce([[]]);

    await taskTemplateService.updateTaskTemplate(8, {
      name: "Updated",
    });

    expect(connection.execute.mock.calls[1][0]).toContain(
      "UPDATE task_templates"
    );
    expect(connection.execute.mock.calls[1][1]).toEqual([
      "Updated",
      8,
    ]);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledTimes(2);
  });

  test("returns 404 when updating a missing template", async () => {
    connection.execute.mockResolvedValueOnce([[]]);

    await expect(
      taskTemplateService.updateTaskTemplate(99, { name: "Updated" })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Task template not found",
    });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test("does not reassign a template already used by an engagement", async () => {
    connection.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([[{ id: 4 }]])
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([[{ service_type_id: 3 }]]);

    await expect(
      taskTemplateService.updateTaskTemplate(8, {
        serviceTypeId: 4,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "A template used by an engagement cannot be reassigned to another service type",
    });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test("updates existing item fields without replacing its ID or deleting omitted items", async () => {
    connection.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 21,
            title: "Old title",
            description: null,
            sequence_no: 1,
            due_days_after_start: 3,
          },
          {
            id: 22,
            title: "Keep title",
            description: null,
            sequence_no: 2,
            due_days_after_start: 4,
          },
          {
            id: 23,
            title: "Retain item",
            description: null,
            sequence_no: 3,
            due_days_after_start: 6,
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    pool.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([[]]);

    await taskTemplateService.updateTaskTemplate(8, {
      items: [
        {
          id: 21,
          title: "Updated title",
          sequence_no: 2,
          due_days_after_start: 9,
        },
        {
          id: 22,
          title: "Keep title",
          sequence_no: 1,
          due_days_after_start: 4,
        },
      ],
    });

    expect(connection.execute.mock.calls[2][1]).toEqual([-1, 21, 8]);
    expect(connection.execute.mock.calls[3][1]).toEqual([-2, 22, 8]);
    expect(connection.execute.mock.calls[4][1]).toEqual([-3, 23, 8]);
    expect(connection.execute.mock.calls[5][1]).toEqual([
      "Updated title",
      null,
      2,
      9,
      21,
      8,
    ]);
    expect(connection.execute.mock.calls[6][1]).toEqual([
      "Keep title",
      null,
      1,
      4,
      22,
      8,
    ]);
    expect(connection.execute.mock.calls[7][1]).toEqual([3, 23, 8]);
    expect(
      connection.execute.mock.calls.some(([query]) =>
        query.includes("DELETE FROM task_template_items")
      )
    ).toBe(false);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test("rolls back item edits if a child update fails", async () => {
    const itemError = new Error("Item update failed");
    connection.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 21,
            title: "Old title",
            description: null,
            sequence_no: 1,
            due_days_after_start: 3,
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockRejectedValueOnce(itemError);

    await expect(
      taskTemplateService.updateTaskTemplate(8, {
        items: [
          {
            id: 21,
            title: "Updated",
            sequence_no: 2,
            due_days_after_start: 3,
          },
        ],
      })
    ).rejects.toBe(itemError);

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test("rejects item IDs that do not belong to the template", async () => {
    connection.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 21,
            title: "Existing item",
            description: null,
            sequence_no: 1,
            due_days_after_start: 2,
          },
        ],
      ]);

    await expect(
      taskTemplateService.updateTaskTemplate(8, {
        items: [
          {
            id: 99,
            title: "Other template item",
            sequence_no: 2,
            due_days_after_start: 3,
          },
        ],
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Template item not found for this template",
    });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.execute).toHaveBeenCalledTimes(2);
  });

  test("maps unique template-version conflicts to 409", async () => {
    const duplicateError = new Error("Duplicate entry");
    duplicateError.code = "ER_DUP_ENTRY";
    connection.execute
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockRejectedValueOnce(duplicateError);

    await expect(
      taskTemplateService.createTaskTemplate({
        serviceTypeId: 3,
        name: "Monthly",
        version: 1,
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test("deactivates a template without deleting it", async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 8 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 8, is_active: 0 }]])
      .mockResolvedValueOnce([[]]);

    await expect(
      taskTemplateService.updateTaskTemplateStatus(8, false)
    ).resolves.toMatchObject({ id: 8, is_active: 0, items: [] });
    expect(pool.execute.mock.calls[1][0]).toContain(
      "UPDATE task_templates"
    );
    expect(pool.execute.mock.calls[1][1]).toEqual([0, 8]);
  });
});
