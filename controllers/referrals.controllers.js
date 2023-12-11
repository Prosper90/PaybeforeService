require("dotenv").config();
const ErrorResponse = require("../utils/errorResponse.js");
const { User } = require("../models/Users.js");
const { Bonus } = require("../models/Bonus.js");

/**
 * this is to get all referrals for user
 *
 */
exports.GetAllRefs = async (req, res, next) => {
  try {
    const refs = await Bonus.find({ owner: req.user._id });
    if (!refs) return next(new ErrorResponse("No ref found"), 201);
    res.status(200).json({ status: true, data: refs });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a particular referral
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.GetRefId = async (req, res, next) => {
  try {
    const particularRef = await Bonus.findById({ _id: req.params.id });
    if (!particularRef) return next(new ErrorResponse("No ref found"), 201);

    res.status(200).json({ status: true, data: particularRef });
  } catch (error) {
    next(error);
  }
};
