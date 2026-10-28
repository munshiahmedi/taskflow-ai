
const taskService = require("../services/taskService");
const aiDescriptionService = require("../services/aiDescriptionService");

function isObjectBody(body) {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

function invalidBodyResponse(res) {
  return res.status(400).json({
    success: false,
    message: "Request body must be a JSON object",
  });
}

// GENERATE TASK DESCRIPTION
async function generateTaskDescription(req, res) {
  if (!isObjectBody(req.body)) {
    return invalidBodyResponse(res);
  }

  const { title, context } = req.body;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: "title is required",
    });
  }

  if (title.trim().length > 255) {
    return res.status(400).json({
      success: false,
      message: "Title must not exceed 255 characters",
    });
  }

  if (
    context !== undefined &&
    context !== null &&
    typeof context !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "context must be a string or null",
    });
  }

  if (typeof context === "string" && context.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "context must not exceed 2000 characters",
    });
  }

  try {
    const description =
      await aiDescriptionService.generateTaskDescription({
        title: title.trim(),
        context: context?.trim() || "",
      });

    return res.status(200).json({
      success: true,
      description,
    });
  } catch (error) {
    const statusCode = [429, 503, 504].includes(error.statusCode)
      ? error.statusCode
      : 502;
    const messages = {
      429: "AI description provider is rate limited. Try again shortly.",
      502: "Unable to generate a task description right now.",
      503: "AI description generation is not configured.",
      504: "AI description generation timed out. Try again.",
    };

    return res.status(statusCode).json({
      success: false,
      message: messages[statusCode],
    });
  }
}

// CREATE TASK
async function createTask(req, res) {
  try {
    if (!isObjectBody(req.body)) {
      return invalidBodyResponse(res);
    }

    const { engagementId, title, description } = req.body;
    const createdBy = req.user.id;

    if (!Number.isInteger(engagementId) || engagementId <= 0) {
      return res.status(400).json({
        success: false,
        message: "engagementId must be a positive integer",
      });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "title is required",
      });
    }

    if (title.trim().length > 255) {
      return res.status(400).json({
        success: false,
        message: "Title must not exceed 255 characters",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string or null",
      });
    }

    if (
      typeof description === "string" &&
      description.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 5000 characters",
      });
    }

    const task = await taskService.createTask({
      engagementId,
      title: title.trim(),
      description,
      createdBy,
      role: req.user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// GET ALL TASKS
async function getTasks(req, res) {
  try {
    const tasks = await taskService.getTasks(req.user);

    return res.status(200).json({
      success: true,
      message: "Tasks retrieved successfully",
      tasks,
    });
  } catch (error) {
    console.error("Get tasks failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// GET TASK BY ID
async function getTaskById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a positive integer",
      });
    }

    const task = await taskService.getTaskById(id, req.user);

    return res.status(200).json({
      success: true,
      message: "Task retrieved successfully",
      task,
    });
  } catch (error) {
    console.error("Get task by ID failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// UPDATE TASK DETAILS
async function updateTask(req, res) {
  try {
    if (!isObjectBody(req.body)) {
      return invalidBodyResponse(res);
    }

    const id = Number(req.params.id);
    const { title, description } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a positive integer",
      });
    }

    if (title === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide title or description",
      });
    }

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must be a non-empty string",
      });
    }

    if (
      title !== undefined &&
      title.trim().length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must not exceed 255 characters",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string or null",
      });
    }

    if (
      typeof description === "string" &&
      description.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 5000 characters",
      });
    }

    const task = await taskService.updateTask(
      id,
      {
        title: title === undefined ? undefined : title.trim(),
        description,
      },
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// DELETE TASK
async function deleteTask(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a positive integer",
      });
    }

    const result = await taskService.deleteTask(id, req.user);

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      task: result,
    });
  } catch (error) {
    console.error("Delete task failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// ASSIGN TASK
async function assignTask(req, res) {
  try {
    if (!isObjectBody(req.body)) {
      return invalidBodyResponse(res);
    }

    const id = Number(req.params.id);
    const { assignedTo } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a positive integer",
      });
    }

    if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
      return res.status(400).json({
        success: false,
        message: "assignedTo must be a positive integer",
      });
    }

    const task = await taskService.assignTask(
      id,
      assignedTo,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Task assigned successfully",
      task,
    });
  } catch (error) {
    console.error("Assign task failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// UPDATE TASK STATUS / SUBMIT FOR REVIEW / REVIEW TASK
async function updateTaskStatus(req, res) {
  try {
    if (!isObjectBody(req.body)) {
      return invalidBodyResponse(res);
    }

    const id = Number(req.params.id);
    const { status, comment } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a positive integer",
      });
    }

    const allowedStatuses = [
      "NOT_STARTED",
      "IN_PROGRESS",
      "WAITING_FOR_CLIENT",
      "READY_FOR_REVIEW",
      "CHANGES_REQUESTED",
      "COMPLETED",
    ];

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    if (
      comment !== undefined &&
      comment !== null &&
      typeof comment !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Comment must be a string",
      });
    }

    if (
      typeof comment === "string" &&
      comment.length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Comment must not exceed 2000 characters",
      });
    }

    const task = await taskService.updateTaskStatus(
      id,
      status,
      req.user,
      comment
    );

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task status failed:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Internal server error",
    });
  }
}

// EXPORT CONTROLLERS
module.exports = {
  generateTaskDescription,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  assignTask,
  updateTaskStatus,
};
