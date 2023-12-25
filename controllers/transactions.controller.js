require("dotenv").config();
const ErrorResponse = require("../utils/errorResponse.js");
const { Transaction } = require("../models/Transaction");

/**
 * this is to update the user password
 *
 */
exports.GetAllTransactions = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalDocuments = await Transaction.countDocuments({
      owner: req.user._id,
    });

    const allTx = await Transaction.find({
      owner: req.user._id,
    });

    const transactions = await Transaction.find({ owner: req.user._id })
      .skip(startIndex)
      .limit(limit);

    if (!transactions) {
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

    res
      .status(200)
      .json({ status: true, data: transactions, pagination, allTx });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Transactions
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.GetTxId = async (req, res, next) => {
  try {
    const transactions = await Transaction.findById({ _id: req.params.id });
    if (!transactions)
      return next(new ErrorResponse("No transactions found"), 201);
    if (transactions)
      res.status(200).json({ status: true, data: transactions });
  } catch (error) {
    next(error);
  }
};
