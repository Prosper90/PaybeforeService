require("dotenv").config();
const bcrypt = require("bcrypt");
const { sendResponseWithToken } = require("../utils/handleResponse");
const { randomInt } = require("crypto");
const { header } = require("express/lib/request");
const { makecall } = require("../utils/makeRequest");
const crypto = require("crypto");
const ErrorResponse = require("../utils/errorResponse.js");
const { User } = require("../models/Users");
const { generateRandomAlphaNumeric } = require("../utils/createTokens");
const { generateLocalHeader } = require("../utils/genHeadersData");
const { Transactions } = require("../models/Transaction");

/**
 * Get a payment link detail or details
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.GetpaymentDetailsfromIDOrLink = async (req, res, next) => {
  const { payment_id } = req.params;

  try {
    const user = await User.findOne({
      "paymentLink.linkID": payment_id,
    });
    if (!user) return next(new ErrorResponse("Id does not exist", 400));
    if (user.kyc === "0")
      return next(new ErrorResponse("This user cannot recieve payments", 400));
    //get the particular payment
    const paymentGet = user.paymentLink.find(
      (element) => element.linkID === payment_id
    );
    console.log(paymentGet, "Payment getters");
    //check status is not successfull
    if (paymentGet.status === "Redeemed")
      return next(
        new ErrorResponse(
          "Payment has already been complete and redeemed.",
          401
        )
      );
    //check if is completetd
    if (paymentGet.isPaid)
      return next(new ErrorResponse("Payment is already completed.", 401));
    //check if it has expired
    if (Date.now() > Date.parse(paymentGet.expired))
      return next(new ErrorResponse("Payment is expired.", 401));

    const paymentObject = {
      clientName: user.full_name,
      amount: paymentGet.amount,
      accountName: user.account.account_Name,
      accountNumber: user.account.account_Number,
      bank: user.account.bank,
      expiration: paymentGet.expired,
    };

    res.status(200).json({ status: true, data: paymentObject });
  } catch (error) {
    next(error);
  }
};

/**
 * Girl generates a payment link
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.GeneratePaymentLink = async (req, res, next) => {
  //Logic is
  //I generate an object with a unique ID, created date and expiration date.
  //update my database, and append the id to the url and return the url and object.
  //checks
  if (!req.user.kyc)
    return next(
      new ErrorResponse("Verify your account to use this feature", 401)
    );
  const { amount } = req.body;
  const appendId = generateRandomAlphaNumeric(6);
  const base = `${req.protocol}://${req.hostname}`;
  const link = `${base}/${appendId}`;
  const Expire = Date.now() + 48 * 3600 * 1000; // Current timestamp + 300 seconds (5 minutes)

  try {
    const newPayment = {
      linkID: appendId,
      expired: Expire,
      amount: amount,
      status: "pending",
      user: req.user._id,
    };

    const paymentGenerated = await User.findOneAndUpdate(
      req.user._id,
      {
        $push: {
          paymentLink: newPayment,
        },
      },
      { new: true }
    );
    //create a transaction

    if (paymentGenerated)
      res
        .status(200)
        .json({ status: true, data: paymentGenerated, link: link });
  } catch (error) {
    next(error);
  }
};

/**
 * Girl redeems her payment
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.ReedemPayment = async (req, res, next) => {
  //I just update the wallets and payment link status if the code submitted is right
  const { redeemCode } = req.body;

  try {
    const check = await User.findOne(
      { _id: req.user.id },
      {
        paymentLink: {
          $elemMatch: { redeemCode: redeemCode },
        },
      }
    );

    if (!check) return next(new ErrorResponse("no such payment", 401));

    const codeChecker = req.user.paymentLink.find(
      (gotten) => gotten.redeemCode === redeemCode
    );

    if (!codeChecker.isPaid)
      return next(new ErrorResponse("This Link has no payment attached", 401));

    await User.findOneAndUpdate(
      { _id: req.user._id, "paymentLink.redeemCode": redeemCode },
      {
        $set: { "paymentLink.$.status": "Reedemed" },
        $inc: {
          "balances.pending_wallet": -codeChecker.amount,
          "balances.main_wallet": codeChecker.amount,
        },
      }
    );

    //update user, transaction and notifications, and even visitor
    let tx = new Transactions({
      type: "Redeem",
      amount: codeChecker.amount,
      currency: "NGN",
      status: "success",
      track_id: codeChecker.linkID,
    });

    const settledObject = {
      id: codeChecker.linkID,
      amount: codeChecker.amount,
      status: codeChecker.status,
      paid: codeChecker.isPaid,
    };

    return res.status(200).json({ status: true, data: settledObject });
  } catch (error) {
    next(error);
  }
};

/**
 * Client Makes payment to girl
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.MakePaymentToLink = async (req, res, next) => {
  //Logic is
  //check that link is not expired
  //make payment to wallet, update paymentLink and store reedem code there.
  const { payment_id } = req.body;

  try {
    const userPayment = await User.findOne({
      paymentLink: { $elemMatch: { linkID: payment_id } },
    });
    if (!userPayment) return new ErrorResponse("Id does not exist", 400);
    const redeemCode = crypto.randomInt(100000, 100001);
    const apiUrl = `${process.env.LOCAL_BASE}/v1/accounts/credit/manual`;

    console.log(
      userPayment.paymentLink.find((one) => one.linkID === payment_id).amount,
      "dirty boy"
    );
    const requestData = {
      amount:
        userPayment.paymentLink.find((one) => one.linkID === payment_id)
          .amount * 100, //sample 1000
      account_id: userPayment.account.issue_id, //sample USD
    };
    // Define the request headers and data
    const headers = generateLocalHeader();
    const response = await makecall(apiUrl, requestData, headers, "post", next);
    if (!response?.success)
      return next(new ErrorResponse(response.message, 401));

    const values = response.data;

    const paymentGenerated = await User.findOneAndUpdate(
      {
        _id: userPayment._id,
        "paymentLink.linkID": payment_id,
      },
      {
        $set: { "paymentLink.$.redeemCode": redeemCode }, // update the redeem code
        // $push: { transactions: transaction._id }, // Add the transaction to the array
      },
      { new: true }
    );

    if (paymentGenerated)
      return res.status(200).json({
        status: true,
        data: paymentGenerated.paymentLink.find(
          (one) => one.linkID === payment_id
        ).redeemCode,
      });
  } catch (error) {
    next(error);
  }
};

/**
 * client cancels payment
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.CancelPayment = async (req, res, next) => {
  //I just update the wallets and payment link status if the code submitted is right
  const { code } = req.body;

  try {
    const check = await User.findOne(
      { _id: req.user.id },
      {
        paymentLink: {
          $elemMatch: { linkID: code },
        },
      }
    );

    if (!check) {
      return next(new ErrorResponse("no such payment", 401));
    }

    await User.findOneAndUpdate(
      { _id: req.user._id, "paymentLink.linkID": code },
      {
        $set: { "paymentLink.$.status": "Cancelled" },
      }
    );

    //update user, transaction and notifications, and even visitor
    // let tx = await Transactions.findByIdAndUpdate(
    //   { _id: transaction._id },
    //   { $set: { status: "success" } },
    //   { new: true }
    // );

    return res.status(200).json({ status: true, data: "" });
  } catch (error) {
    next(error);
  }
};
