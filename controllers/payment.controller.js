const { makecall } = require("../utils/makeRequest");
const crypto = require("crypto");
const ErrorResponse = require("../utils/errorResponse.js");
const { User } = require("../models/Users");
const { generateRandomAlphaNumeric } = require("../utils/createTokens");
const { generateLocalHeader } = require("../utils/genHeadersData");
const { Transaction } = require("../models/Transaction");

/**
 * Get a payment link detail or details
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.VerifypaymentDetailsfromIDOrLink = async (req, res, next) => {
  const { payment_id } = req.params;

  try {
    const user = await User.findOne({
      "paymentLink.linkID": payment_id,
    });
    if (!user) return next(new ErrorResponse("Id does not exist", 400));
    //get the particular payment
    const paymentGet = user.paymentLink.find(
      (element) => element.linkID === payment_id
    );
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
      return next(new ErrorResponse("Payment is already completed.", 203));
    //check if it has expired
    if (Date.now() > Date.parse(paymentGet.expired))
      return next(new ErrorResponse("Payment is expired.", 203));

    // account_number: values.account_number,
    // bank_name: values.bank_name,
    // account_name: values.name,
    const paymentObject = {
      clientName: user.full_name,
      payId: paymentGet.linkID,
      amount: paymentGet.amount,
      accountId: paymentGet.issue_id,
      accountName: paymentGet.account_name,
      accountNumber: paymentGet.account_number,
      bank: paymentGet.bank_name,
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
  const { amount } = req.body;

  const apiUrl = `${process.env.LOCAL_BASE}v1/accounts/collections`;

  const headersLocal = generateLocalHeader();

  // Create a customer on third party request body
  const RequestData = {
    preferred_bank: "Wema",
    alias: req.user.first_name,
    collection_rules: {
      frequency: 1,
      amount: amount * 100,
    },
  };

  //make  local call
  const responseLocal = await makecall(
    apiUrl,
    RequestData,
    headersLocal,
    "post",
    next
  );

  if (!responseLocal.success) {
    return next(new ErrorResponse(responseLocal.message, 400));
  }
  const values = responseLocal.data;

  const appendId = generateRandomAlphaNumeric(6);
  const base = `${req.protocol}://${req.hostname}`;
  const link = `${base}/${appendId}`;
  const Expire = Date.now() + 48 * 3600 * 1000; // Current timestamp + 300 seconds (5 minutes)

  try {
    const newPayment = {
      linkID: appendId,
      issue_id: values.id,
      account_number: values.account_number,
      bank_name: values.bank_name,
      account_name: values.name,
      expired: Expire,
      amount: amount,
      status: "pending",
      user: req.user._id,
    };

    //update user, transaction and notifications, and even visitor
    const tx = new Transaction({
      type: "Payment",
      payment: {
        linkID: appendId,
        expired: Expire,
        amount: amount,
        status: "pending",
        reciever: req.user._id,
      },
      track_id: appendId,
    });

    await tx.save();

    const paymentGenerated = await User.findOneAndUpdate(
      req.user._id,
      {
        $push: {
          paymentLink: newPayment,
          recent_transactions: tx._id,
        },
      },
      { new: true }
    );
    //create a transaction

    if (paymentGenerated)
      res.status(200).json({
        status: true,
        data: newPayment.linkID,
        link: link,
        values: values,
      });
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
    if (check.paymentLink.length === 0)
      return next(new ErrorResponse("No such payment", 401));

    const codeChecker = req.user.paymentLink.find(
      (gotten) => gotten.redeemCode === redeemCode
    );
    if (!codeChecker.isPaid)
      return next(new ErrorResponse("This Tx has not been paid for", 401));

    const updatedChecker = await User.findOneAndUpdate(
      { _id: req.user._id, "paymentLink.redeemCode": redeemCode },
      {
        $set: { "paymentLink.$.status": "Redeemed" },
        $inc: {
          "balances.pending_wallet": -codeChecker.amount,
          "balances.main_wallet": codeChecker.amount,
        },
      },
      { new: true }
    );

    await Transaction.findOneAndUpdate(
      { "payment.linkID": codeChecker.linkID },
      {
        $set: { "payment.isRedeemed": true },
      }
    );

    const settledObject = {
      id: codeChecker.linkID,
      amount: codeChecker.amount,
      status: updatedChecker.paymentLink.find(
        (gotten) => gotten.redeemCode === redeemCode
      ).status,
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
  const { payment_id, amount } = req.body;

  try {
    const userPayment = await User.findOne(
      { "paymentLink.linkID": payment_id },
      { "paymentLink.$": 1 }
    );

    if (!userPayment) return new ErrorResponse("Id does not exist", 400);
    const apiUrl = `${process.env.LOCAL_BASE}/v1/accounts/credit/manual`;

    const requestData = {
      amount: amount * 100, //sample 1000
      account_id: userPayment.paymentLink[0].issue_id, //sample id
    };
    console.log(requestData, "request Data");
    // Define the request headers and data
    const headersLocal = generateLocalHeader(next);
    const response = await makecall(
      apiUrl,
      requestData,
      headersLocal,
      "post",
      next
    );
    console.log(response, "here oooo");
    if (!response?.success)
      return next(new ErrorResponse(response.message, 401));

    const values = response.data;

    return res.status(200).json({
      status: true,
      message: "Payment sent",
      data: values,
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
