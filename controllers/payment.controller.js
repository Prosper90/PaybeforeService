const { makecall } = require("../utils/makeRequest");
const crypto = require("crypto");
const ErrorResponse = require("../utils/errorResponse.js");
const { User } = require("../models/Users");
const { generateRandomAlphaNumeric } = require("../utils/createTokens");
const { generateLocalHeader } = require("../utils/genHeadersData");
const { Transaction } = require("../models/Transaction");
const { Bonus } = require("../models/Bonus.js");

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
    if (paymentGet.isPaid === "complete")
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
    preferred_bank: "Sterling",
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
  //const base = `${req.protocol}://${req.hostname}`;
  //const link = `${base}/${appendId}`;
  const Expire = Date.now() + 48 * 3600 * 1000; // Current timestamp + 300 seconds (5 minutes)

  try {
    const newPayment = {
      linkID: appendId,
      issue_id: values.id,
      account_number: values.account_number,
      bank_name: values.bank_name,
      account_name: values.name,
      expired: Expire,
      amount_created: amount,
      isPaid: "pending",
      status: "pending",
      user: req.user._id,
    };

    //update user, transaction and notifications, and even visitor
    const tx = new Transaction({
      type: "Payment",
      payment: {
        linkID: appendId,
        expired: Expire,
        amount_created: amount,
        amount_paid: 0,
        reciever: req.user._id,
      },
      owner: req.user._id,
      status: "pending",
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
      },
      { "paymentLink.$": 1 }
    );

    //return res.status(200).json({ data: check });
    if (check.paymentLink[0].length === 0)
      return next(new ErrorResponse("No such payment", 401));

    // const codeChecker = req.user.paymentLink.find(
    //   (gotten) => gotten.redeemCode === redeemCode
    // );
    if (check.paymentLink[0].isPaid === "failed")
      return next(new ErrorResponse("This Tx has issues contact support", 401));

    if (check.paymentLink[0].isPaid === "pending")
      return next(new ErrorResponse("This Tx has not been paid for", 401));

    if (check.paymentLink[0].isPaid === "incomplete")
      return next(new ErrorResponse("This Payment is not complete", 401));

    const updatedChecker = await User.findOneAndUpdate(
      { _id: req.user._id, "paymentLink.redeemCode": redeemCode },
      {
        $set: { "paymentLink.$.status": "Redeemed" },
        $inc: {
          "balances.pending_wallet": -check.paymentLink[0].amount_paid,
          "balances.main_wallet": check.paymentLink[0].amount_paid,
        },
      },
      { new: true }
    );

    await Transaction.findOneAndUpdate(
      { "payment.linkID": check.paymentLink[0].linkID },
      {
        $set: { "payment.isRedeemed": true },
      }
    );

    if (req.user.referer) {
      const findReferer = await User.findOne({
        userReferralID: req.user.referer,
      });

      await User.findOneAndUpdate(
        { _id: findReferer._id },
        {
          $inc: {
            "balances.refferal_wallet":
              (3 * check.paymentLink[0].amount_paid) / 100,
            "balances.main_wallet":
              (3 * check.paymentLink[0].amount_paid) / 100,
          },
        },
        { new: true }
      );

      const bonus = new Bonus({
        type: "Referral Bonus",
        status: "success",
        amount: (3 * check.paymentLink[0].amount_paid) / 100,
        owner: findReferer._id,
      });

      await bonus.save();
    }

    const settledObject = {
      id: check.paymentLink[0].linkID,
      amount: check.paymentLink[0].amount_paid,
      status: updatedChecker.paymentLink.find(
        (gotten) => gotten.redeemCode === redeemCode
      ).status,
      paid: check.paymentLink[0].isPaid,
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

    console.log(check, "checkers");

    // if (check.paymentLink.length === 0) {
    //   return next(new ErrorResponse("no such payment", 401));
    // }

    await User.findOneAndUpdate(
      { _id: req.user._id, "paymentLink.linkID": code },
      {
        $set: {
          "paymentLink.$.status": "cancelled",
          "paymentLink.$.isPaid": "failed",
        },
      }
    );

    //find the transaction and cancel also
    await Transaction.findOneAndUpdate(
      { track_id: code },
      {
        $set: {
          "payment.isPaid": "failed",
          status: "cancelled",
        },
      }
    );

    //update user, transaction and notifications, and even visitor
    // let tx = await Transactions.findByIdAndUpdate(
    //   { _id: transaction._id },
    //   { $set: { status: "success" } },
    //   { new: true }
    // );

    return res
      .status(200)
      .json({ status: true, message: "transaction cancelled" });
  } catch (error) {
    next(error);
  }
};
