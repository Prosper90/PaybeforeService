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
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalDocuments = await Bonus.countDocuments({
      owner: req.user._id,
    });

    const allRefs = await Bonus.find({
      owner: req.user._id,
    });
    // const refs = await Bonus.find({ owner: req.user._id });
    const refs = await Bonus.find({ owner: req.user._id })
      .skip(startIndex)
      .limit(limit);

    if (!refs) {
      return next(new ErrorResponse("No transactions found"), 201);
    }
    const pagination = {};

    if (endIndex < totalDocuments) {
      pagination.next = {
        page: page + 1,
        limit: limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit: limit,
      };
    }
    res.status(200).json({ status: true, data: refs, pagination, allRefs });
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
