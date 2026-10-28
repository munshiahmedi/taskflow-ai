const serviceTypeService = require("../services/serviceTypeService");

const engagementKinds = ["ONE_TIME", "RECURRING"];
const recurrenceIntervals = ["MONTHLY", "QUARTERLY", "YEARLY"];

function parseServiceTypeId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function sendBadRequest(res, message) {
  return res.status(400).json({
    success: false,
    message,
  });
}

function validateDescription(description) {
  return (
    description === null ||
    (typeof description === "string" &&
      Buffer.byteLength(description, "utf8") <= 65535)
  );
}

function validateEngagementKind(value) {
  return engagementKinds.includes(value);
}

function validateRecurrenceInterval(value) {
  return value === null || recurrenceIntervals.includes(value);
}

async function getServiceTypes(req, res, next) {
  try {
    const { search, active } = req.query;

    if (
      search !== undefined &&
      (typeof search !== "string" || search.length > 255)
    ) {
      return sendBadRequest(
        res,
        "search must be a string of at most 255 characters"
      );
    }

    let isActive;

    if (active !== undefined) {
      if (!["true", "false", "1", "0"].includes(active)) {
        return sendBadRequest(
          res,
          "active must be true, false, 1, or 0"
        );
      }

      isActive = active === "true" || active === "1";
    }

    const serviceTypes = await serviceTypeService.getServiceTypes({
      search: search?.trim() || undefined,
      isActive,
    });

    return res.status(200).json({
      success: true,
      count: serviceTypes.length,
      serviceTypes,
    });
  } catch (error) {
    return next(error);
  }
}

async function getServiceTypeById(req, res, next) {
  try {
    const id = parseServiceTypeId(req.params.id);

    if (id === null) {
      return sendBadRequest(
        res,
        "Service type ID must be a positive integer"
      );
    }

    const serviceType = await serviceTypeService.getServiceTypeById(id);

    return res.status(200).json({
      success: true,
      message: "Service type retrieved successfully",
      serviceType,
    });
  } catch (error) {
    return next(error);
  }
}

async function createServiceType(req, res, next) {
  try {
    const body = req.body || {};
    const { name, engagement_kind: engagementKind } = body;

    if (typeof name !== "string" || !name.trim()) {
      return sendBadRequest(res, "name is required");
    }

    if (name.trim().length > 150) {
      return sendBadRequest(
        res,
        "name must not exceed 150 characters"
      );
    }

    if (!validateEngagementKind(engagementKind)) {
      return sendBadRequest(
        res,
        "engagement_kind must be ONE_TIME or RECURRING"
      );
    }

    if (
      body.description !== undefined &&
      !validateDescription(body.description)
    ) {
      return sendBadRequest(
        res,
        "description must be a string or null of at most 65535 bytes"
      );
    }

    const recurrenceInterval =
      body.recurrence_interval === undefined
        ? null
        : body.recurrence_interval;

    if (!validateRecurrenceInterval(recurrenceInterval)) {
      return sendBadRequest(
        res,
        "recurrence_interval must be MONTHLY, QUARTERLY, YEARLY, or null"
      );
    }

    const serviceType = await serviceTypeService.createServiceType({
      name: name.trim(),
      description: body.description ?? null,
      engagementKind,
      recurrenceInterval,
    });

    return res.status(201).json({
      success: true,
      message: "Service type created successfully",
      serviceType,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateServiceType(req, res, next) {
  try {
    const id = parseServiceTypeId(req.params.id);

    if (id === null) {
      return sendBadRequest(
        res,
        "Service type ID must be a positive integer"
      );
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return sendBadRequest(
          res,
          "name must be a non-empty string"
        );
      }

      if (body.name.trim().length > 150) {
        return sendBadRequest(
          res,
          "name must not exceed 150 characters"
        );
      }

      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      if (!validateDescription(body.description)) {
        return sendBadRequest(
          res,
          "description must be a string or null of at most 65535 bytes"
        );
      }

      updates.description = body.description;
    }

    if (body.engagement_kind !== undefined) {
      if (!validateEngagementKind(body.engagement_kind)) {
        return sendBadRequest(
          res,
          "engagement_kind must be ONE_TIME or RECURRING"
        );
      }

      updates.engagementKind = body.engagement_kind;
    }

    if (body.recurrence_interval !== undefined) {
      if (!validateRecurrenceInterval(body.recurrence_interval)) {
        return sendBadRequest(
          res,
          "recurrence_interval must be MONTHLY, QUARTERLY, YEARLY, or null"
        );
      }

      updates.recurrenceInterval = body.recurrence_interval;
    }

    if (Object.keys(updates).length === 0) {
      return sendBadRequest(
        res,
        "Provide name, description, engagement_kind, or recurrence_interval to update"
      );
    }

    const serviceType = await serviceTypeService.updateServiceType(
      id,
      updates
    );

    return res.status(200).json({
      success: true,
      message: "Service type updated successfully",
      serviceType,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateServiceTypeStatus(req, res, next) {
  try {
    const id = parseServiceTypeId(req.params.id);

    if (id === null) {
      return sendBadRequest(
        res,
        "Service type ID must be a positive integer"
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

    const serviceType = await serviceTypeService.updateServiceTypeStatus(
      id,
      isActive === true || isActive === 1 || isActive === "1"
    );

    return res.status(200).json({
      success: true,
      message: "Service type status updated successfully",
      serviceType,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createServiceType,
  getServiceTypes,
  getServiceTypeById,
  updateServiceType,
  updateServiceTypeStatus,
};
