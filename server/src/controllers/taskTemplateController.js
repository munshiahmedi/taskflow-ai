const taskTemplateService = require("../services/taskTemplateService");

const templateFields = ["service_type_id", "name", "version"];
const itemFields = [
  "id",
  "title",
  "description",
  "sequence_no",
  "due_days_after_start",
];
const maxSqlInt = 2147483647;

function parseId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id <= maxSqlInt ? id : null;
}

function sendBadRequest(res, message) {
  return res.status(400).json({
    success: false,
    message,
  });
}

function hasOnlyFields(value, fields) {
  return Object.keys(value).every((field) => fields.includes(field));
}

function isPositiveInteger(value) {
  return (
    Number.isSafeInteger(value) && value > 0 && value <= maxSqlInt
  );
}

function isNonNegativeInteger(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maxSqlInt
  );
}

function validateName(name) {
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    name.trim().length <= 150
  );
}

function validateItems(items, { creating }) {
  if (!Array.isArray(items)) {
    return "items must be an array";
  }

  if (items.length === 0) {
    return "items must contain at least one item when provided";
  }

  const itemIds = new Set();
  const sequences = new Set();

  for (const item of items) {
    if (
      item === null ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !hasOnlyFields(item, itemFields)
    ) {
      return "Each item must contain only supported template item fields";
    }

    if (
      item.id !== undefined &&
      (creating ||
        !isPositiveInteger(item.id) ||
        itemIds.has(item.id))
    ) {
      return "Item IDs must be unique positive integers";
    }

    if (item.id !== undefined) {
      itemIds.add(item.id);
    }

    if (
      typeof item.title !== "string" ||
      !item.title.trim() ||
      item.title.trim().length > 255
    ) {
      return "Each item title must be a non-empty string of at most 255 characters";
    }

    if (
      item.description !== undefined &&
      item.description !== null &&
      (typeof item.description !== "string" ||
        Buffer.byteLength(item.description, "utf8") > 65535)
    ) {
      return "Item description must be a string or null of at most 65535 bytes";
    }

    if (!isPositiveInteger(item.sequence_no)) {
      return "Each item sequence_no must be a positive integer";
    }

    if (sequences.has(item.sequence_no)) {
      return "Item sequence_no values must be unique";
    }
    sequences.add(item.sequence_no);

    if (!isNonNegativeInteger(item.due_days_after_start)) {
      return "Each item due_days_after_start must be a non-negative integer";
    }
  }

  return null;
}

function validateTemplateFields(body, { creating }) {
  if (!hasOnlyFields(body, [...templateFields, "items"])) {
    return "Only service_type_id, name, version, and items are supported";
  }

  if (creating || body.service_type_id !== undefined) {
    if (!isPositiveInteger(body.service_type_id)) {
      return "service_type_id must be a positive integer";
    }
  }

  if (creating || body.name !== undefined) {
    if (!validateName(body.name)) {
      return "name must be a non-empty string of at most 150 characters";
    }
  }

  if (
    body.version !== undefined &&
    !isPositiveInteger(body.version)
  ) {
    return "version must be a positive integer";
  }

  if (creating && body.version === undefined) {
    body.version = 1;
  }

  if (body.items !== undefined) {
    return validateItems(body.items, { creating });
  }

  return null;
}

async function getTaskTemplates(req, res, next) {
  try {
    const { service_type_id: serviceTypeId, active } = req.query;
    let parsedServiceTypeId;
    let isActive;

    if (serviceTypeId !== undefined) {
      if (
        typeof serviceTypeId !== "string" ||
        !/^[1-9]\d*$/.test(serviceTypeId) ||
        !isPositiveInteger(Number(serviceTypeId))
      ) {
        return sendBadRequest(
          res,
          "service_type_id must be a positive integer"
        );
      }

      parsedServiceTypeId = Number(serviceTypeId);
    }

    if (active !== undefined) {
      if (!["true", "false", "1", "0"].includes(active)) {
        return sendBadRequest(
          res,
          "active must be true, false, 1, or 0"
        );
      }

      isActive = active === "true" || active === "1";
    }

    const taskTemplates = await taskTemplateService.getTaskTemplates({
      serviceTypeId: parsedServiceTypeId,
      isActive,
    });

    return res.status(200).json({
      success: true,
      count: taskTemplates.length,
      taskTemplates,
    });
  } catch (error) {
    return next(error);
  }
}

async function getTaskTemplateById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return sendBadRequest(
        res,
        "Task template ID must be a positive integer"
      );
    }

    const taskTemplate = await taskTemplateService.getTaskTemplateById(id);

    return res.status(200).json({
      success: true,
      message: "Task template retrieved successfully",
      taskTemplate,
    });
  } catch (error) {
    return next(error);
  }
}

async function createTaskTemplate(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    const validationError = validateTemplateFields(body, {
      creating: true,
    });
    if (validationError) {
      return sendBadRequest(res, validationError);
    }

    const taskTemplate = await taskTemplateService.createTaskTemplate({
      serviceTypeId: body.service_type_id,
      name: body.name.trim(),
      version: body.version,
      items: body.items,
    });

    return res.status(201).json({
      success: true,
      message: "Task template created successfully",
      taskTemplate,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTaskTemplate(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return sendBadRequest(
        res,
        "Task template ID must be a positive integer"
      );
    }

    const body = { ...(req.body || {}) };
    const validationError = validateTemplateFields(body, {
      creating: false,
    });
    if (validationError) {
      return sendBadRequest(res, validationError);
    }

    const updates = {};
    if (body.service_type_id !== undefined) {
      updates.serviceTypeId = body.service_type_id;
    }
    if (body.name !== undefined) {
      updates.name = body.name.trim();
    }
    if (body.version !== undefined) {
      updates.version = body.version;
    }
    if (body.items !== undefined) {
      updates.items = body.items;
    }

    if (Object.keys(updates).length === 0) {
      return sendBadRequest(
        res,
        "Provide service_type_id, name, version, or items to update"
      );
    }

    const taskTemplate = await taskTemplateService.updateTaskTemplate(
      id,
      updates
    );

    return res.status(200).json({
      success: true,
      message: "Task template updated successfully",
      taskTemplate,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTaskTemplateStatus(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return sendBadRequest(
        res,
        "Task template ID must be a positive integer"
      );
    }

    const { is_active: isActive } = req.body || {};
    if (
      typeof isActive !== "boolean" &&
      ![0, 1, "0", "1"].includes(isActive)
    ) {
      return sendBadRequest(
        res,
        "is_active must be a boolean, 0, or 1"
      );
    }

    const taskTemplate =
      await taskTemplateService.updateTaskTemplateStatus(
        id,
        isActive === true || isActive === 1 || isActive === "1"
      );

    return res.status(200).json({
      success: true,
      message: "Task template status updated successfully",
      taskTemplate,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createTaskTemplate,
  getTaskTemplates,
  getTaskTemplateById,
  updateTaskTemplate,
  updateTaskTemplateStatus,
};
