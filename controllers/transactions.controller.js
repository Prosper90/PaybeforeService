require("dotenv").config();
const { randomInt } = require("crypto");
const { makecall } = require("../utils/makeRequest");
const crypto = require("crypto");
const ErrorResponse = require("../utils/errorResponse.js");
const { Transaction } = require("../models/Transaction");

/**
 * this is to update the user password
 *
 */
exports.GetAllTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find();
    if (!transactions)
      return next(new ErrorResponse("No transactions found"), 201);
    if (transactions)
      res.status(200).json({ status: true, data: transactions });
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
