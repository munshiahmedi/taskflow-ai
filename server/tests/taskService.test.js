
jest.mock("../src/config/db", () => ({
  execute: jest.fn(),
  getConnection: jest.fn(),
}));

const pool = require("../src/config/db");
const taskService = require("../src/services/taskService");

describe("Task status workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should reject a team member moving NOT_STARTED directly to COMPLETED", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 10,
          engagement_id: 5,
          title: "Prepare monthly report",
          created_by: 3,
          assigned_to: 7,
          status: "NOT_STARTED",
        },
      ],
    ]);

    const teamMember = {
      id: 7,
      role: "TEAM_MEMBER",
    };

    await expect(
      taskService.updateTaskStatus(10, "COMPLETED", teamMember)
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("should deny a team member access to another user's task", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const teamMember = {
      id: 8,
      role: "TEAM_MEMBER",
    };

    await expect(
      taskService.updateTaskStatus(10, "IN_PROGRESS", teamMember)
    ).rejects.toMatchObject({
      message: "Task not found or access denied",
      statusCode: 404,
    });

    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("should reject a manager reviewing their own assigned task", async () => {
    pool.execute.mockResolvedValueOnce([
      [
        {
          id: 10,
          engagement_id: 5,
          title: "Prepare monthly report",
          created_by: 3,
          assigned_to: 3,
          status: "READY_FOR_REVIEW",
        },
      ],
    ]);

    const manager = {
      id: 3,
      role: "MANAGER",
    };

    await expect(
      taskService.updateTaskStatus(10, "COMPLETED", manager)
    ).rejects.toMatchObject({
      message: "You cannot approve your own task",
      statusCode: 403,
    });

    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("should allow an assigned team member to start a task", async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn()
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            description: "",
            created_by: 3,
            assigned_to: 7,
            status: "NOT_STARTED",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            description: "",
            created_by: 3,
            assigned_to: 7,
            status: "IN_PROGRESS",
            review_comment: null,
            completed_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      ]);

    pool.getConnection.mockResolvedValueOnce(connection);

    const teamMember = {
      id: 7,
      role: "TEAM_MEMBER",
    };

    await taskService.updateTaskStatus(
      10,
      "IN_PROGRESS",
      teamMember
    );

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO task_history"),
      [10, 7, "NOT_STARTED", "IN_PROGRESS", null]
    );
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test("should allow an assigned team member to submit an in-progress task for review", async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn()
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };

    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: 7,
            status: "IN_PROGRESS",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: 7,
            status: "READY_FOR_REVIEW",
          },
        ],
      ]);

    pool.getConnection.mockResolvedValueOnce(connection);

    await taskService.updateTaskStatus(
      10,
      "READY_FOR_REVIEW",
      { id: 7, role: "TEAM_MEMBER" }
    );

    expect(connection.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("UPDATE tasks"),
      ["READY_FOR_REVIEW", null, "READY_FOR_REVIEW", 10]
    );
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });
});

describe("Task assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("assigns a task to an active team member", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: null,
            status: "NOT_STARTED",
          },
        ],
      ])
      .mockResolvedValueOnce([
        [{ id: 7 }],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: 7,
            status: "NOT_STARTED",
          },
        ],
      ]);

    const manager = {
      id: 3,
      role: "MANAGER",
    };

    const result = await taskService.assignTask(10, 7, manager);

    expect(result.assigned_to).toBe(7);
    expect(pool.execute).toHaveBeenCalledTimes(4);
  });

  test("rejects assigning a task to a nonexistent user", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: null,
            status: "NOT_STARTED",
          },
        ],
      ])
      .mockResolvedValueOnce([[]]);

    const manager = {
      id: 3,
      role: "MANAGER",
    };

    await expect(
      taskService.assignTask(10, 99, manager)
    ).rejects.toMatchObject({
      message: "Active team member not found",
      statusCode: 404,
    });

    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("role = 'TEAM_MEMBER'"),
      [99]
    );
  });

  test("rejects assigning a task to an inactive team member", async () => {
    pool.execute
      .mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: null,
            status: "NOT_STARTED",
          },
        ],
      ])
      .mockResolvedValueOnce([[]]);

    await expect(
      taskService.assignTask(10, 99, {
        id: 3,
        role: "MANAGER",
      })
    ).rejects.toMatchObject({
      message: "Active team member not found",
      statusCode: 404,
    });

    expect(pool.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("is_active = 1"),
      [99]
    );
  });

  test("rejects a manager accessing another manager's task", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const manager = {
      id: 3,
      role: "MANAGER",
    };

    await expect(
      taskService.assignTask(10, 7, manager)
    ).rejects.toMatchObject({
      message: "Task not found or access denied",
      statusCode: 404,
    });

    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  test("rejects a manager reading a task outside their engagement scope", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      taskService.getTaskById(10, {
        id: 3,
        role: "MANAGER",
      })
    ).rejects.toMatchObject({
      message: "Task not found or access denied",
      statusCode: 404,
    });

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("AND e.created_by = ?"),
      [10, 3]
    );
  });

  test("limits a manager's task list to engagements they created", async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await taskService.getTasks({
      id: 3,
      role: "MANAGER",
    });

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE e.created_by = ?"),
      [3]
    );
  });

  test.each([
    ["ADMIN", undefined],
    ["ADMIN", "   "],
    ["MANAGER", undefined],
    ["MANAGER", "   "],
  ])(
    "requires a review comment when %s requests changes with comment %p",
    async (role, comment) => {
      pool.execute.mockResolvedValueOnce([
        [
          {
            id: 10,
            engagement_id: 5,
            title: "Prepare monthly report",
            created_by: 3,
            assigned_to: 7,
            status: "READY_FOR_REVIEW",
          },
        ],
      ]);

      await expect(
        taskService.updateTaskStatus(
          10,
          "CHANGES_REQUESTED",
          { id: 3, role },
          comment
        )
      ).rejects.toMatchObject({
        message: "A review comment is required when requesting changes",
        statusCode: 400,
      });

      expect(pool.getConnection).not.toHaveBeenCalled();
    }
  );
});
