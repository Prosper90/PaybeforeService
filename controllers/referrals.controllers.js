require("dotenv").config();
const ErrorResponse = require("../utils/errorResponse.js");
const { Transaction } = require("../models/Transaction");
const { User } = require("../models/Users.js");

/**
 * this is to get all referrals for user
 *
 */
exports.GetAllRefs = async (req, res, next) => {
  try {
    const refs = await User.findById(req.user.id).populate("referringUserIDs");
    if (!refs) return next(new ErrorResponse("No ref found"), 201);
    res.status(200).json({ status: true, data: refs.referringUserIDs });
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
    const particularRef = await User.findById(
      { _id: req.user.id, "referringUserIDs._id": req.params.user },
      { "referringUserIDs.$": 1 }
    ).populate("referringUserIDs");
    if (!particularRef) return next(new ErrorResponse("No ref found"), 201);

    res.status(200).json({ status: true, data: particularRef });
  } catch (error) {
    next(error);
  }
};
