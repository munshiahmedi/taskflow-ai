
const clientService = require("../services/clientService");

function parseClientId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return value.trim() || null;
}

function validateEmail(value) {
  if (value === null) {
    return true;
  }

  return (
    typeof value === "string" &&
    value.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function validatePhone(value) {
  return (
    value === null ||
    (typeof value === "string" && value.length <= 30)
  );
}

function sendBadRequest(res, message) {
  return res.status(400).json({
    success: false,
    message,
  });
}

async function getClients(req, res, next) {
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

    const clients = await clientService.getClients({
      search: search?.trim() || undefined,
      isActive,
    });

    return res.status(200).json({
      success: true,
      count: clients.length,
      clients,
    });
  } catch (error) {
    return next(error);
  }
}

async function getClientById(req, res, next) {
  try {
    const id = parseClientId(req.params.id);

    if (id === null) {
      return sendBadRequest(
        res,
        "Client ID must be a positive integer"
      );
    }

    const client = await clientService.getClientById(id);

    return res.status(200).json({
      success: true,
      message: "Client retrieved successfully",
      client,
    });
  } catch (error) {
    return next(error);
  }
}

async function createClient(req, res, next) {
  try {
    const body = req.body || {};
    const { name } = body;

    if (typeof name !== "string" || !name.trim()) {
      return sendBadRequest(res, "name is required");
    }

    if (name.trim().length > 150) {
      return sendBadRequest(
        res,
        "name must not exceed 150 characters"
      );
    }

    if (
      body.email !== undefined &&
      body.email !== null &&
      typeof body.email !== "string"
    ) {
      return sendBadRequest(res, "email must be a string");
    }

    if (
      body.phone !== undefined &&
      body.phone !== null &&
      typeof body.phone !== "string"
    ) {
      return sendBadRequest(res, "phone must be a string");
    }

    const email = normalizeOptionalString(body.email);
    const phone = normalizeOptionalString(body.phone);

    if (!validateEmail(email)) {
      return sendBadRequest(
        res,
        "email must be a valid email address"
      );
    }

    if (!validatePhone(phone)) {
      return sendBadRequest(
        res,
        "phone must not exceed 30 characters"
      );
    }

    const client = await clientService.createClient({
      name: name.trim(),
      email,
      phone,
    });

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      client,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateClient(req, res, next) {
  try {
    const id = parseClientId(req.params.id);

    if (id === null) {
      return sendBadRequest(
        res,
        "Client ID must be a positive integer"
      );
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
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

    if (body.email !== undefined) {
      if (
        body.email !== null &&
        typeof body.email !== "string"
      ) {
        return sendBadRequest(res, "email must be a string");
      }

      updates.email = normalizeOptionalString(body.email);

      if (!validateEmail(updates.email)) {
        return sendBadRequest(
          res,
          "email must be a valid email address"
        );
      }
    }

    if (body.phone !== undefined) {
      if (
        body.phone !== null &&
        typeof body.phone !== "string"
      ) {
        return sendBadRequest(res, "phone must be a string");
      }

      updates.phone = normalizeOptionalString(body.phone);

      if (!validatePhone(updates.phone)) {
        return sendBadRequest(
          res,
          "phone must not exceed 30 characters"
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return sendBadRequest(
        res,
        "Provide name, email, or phone to update"
      );
    }

    const client = await clientService.updateClient(id, updates);

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      client,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateClientStatus(req, res, next) {
  try {
    const id = parseClientId(req.params.id);

    if (id === null) {
      return sendBadRequest(
        res,
        "Client ID must be a positive integer"
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

    const client = await clientService.updateClientStatus(
      id,
      isActive === true || isActive === 1 || isActive === "1"
    );

    return res.status(200).json({
      success: true,
      message: "Client status updated successfully",
      client,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  updateClientStatus,
};
