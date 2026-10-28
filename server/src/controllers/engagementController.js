
const engagementService = require("../services/engagementService");

async function createEngagement(req, res, next) {
  try {
    const engagement = await engagementService.createEngagement(
      req.body,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Engagement created successfully",
      engagement,
    });
  } catch (error) {
    next(error);
  }
}

async function getEngagements(req, res, next) {
  try {
    const engagements = await engagementService.getEngagements(
      req.user
    );

    return res.status(200).json({
      success: true,
      count: engagements.length,
      engagements,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEngagement,
  getEngagements,
};
