require("dotenv").config();
const ErrorResponse = require("../utils/errorResponse.js");
const { Transaction } = require("../models/Transaction");
const { Dispute } = require("../models/Dispute.js");
const { generateRandomAlphaNumeric } = require("../utils/createTokens.js");
const { cli } = require("winston/lib/winston/config/index.js");
const { User } = require("../models/Users.js");

/*
get all disputes associated with an account
*/
exports.GetAllDisputes = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalDocuments = await Dispute.countDocuments({
      owner: req.user.email,
      reciever: req.user.username,
    });

    const allDx = await Dispute.find({
      owner: req.user.email,
      reciever: req.user.username,
    });

    const disputes = await Dispute.find({ owner: req.user.email })
      .skip(startIndex)
      .limit(limit);

    if (!disputes) {
      return next(new ErrorResponse("disputes not found"), 201);
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

    res.status(200).json({ status: true, data: disputes, pagination, allDx });
  } catch (error) {
    next(error);
  }
};
/**
 * this is to update the user password
 *
 */
exports.Createdispute = async (req, res, next) => {
  try {
    // I check the type
    //from the type I
    const {
      email,
      pay_id,
      dispute_id,
      reason,
      type,
      sender,
      reciever,
      payment_status,
      amount,
      client_tx,
      refund,
      owner,
    } = req.body;
    const findDispute = await Dispute.findOne({ dispute_id: dispute_id });
    const findByPayId = await User.findOne(
      {
        paymentLink: {
          $elemMatch: { linkID: pay_id },
        },
      },
      { "paymentLink.$": 1 }
    );

    let dispute;
    let dispute_id_generated = generateRandomAlphaNumeric(8);
    let remind = false;
    if (!findDispute && type !== "transaction") {
      dispute = new Dispute({
        type: type,
        status: "pending",
        dispute_id: dispute_id_generated,
        email: email,
        reason: reason,
        reminder: 0,
        owner: email,
      });

      dispute.save();
    } else if (!findDispute && type === "transaction") {
      dispute = new Dispute({
        type: type,
        status: "pending",
        dispute_id: dispute_id_generated,
        payment_status: payment_status,
        amount: amount,
        sender: sender,
        reciever: reciever,
        client_tx: client_tx,
        refund: refund,
        reason: reason,
        reminder: 0,
        owner: email,
      });

      dispute.save();
    } else if (
      !findDispute &&
      findByPayId.paymentLink[0].linkID === pay_id &&
      type === "transaction"
    ) {
      dispute = new Dispute({
        type: type,
        status: "pending",
        dispute_id: pay_id,
        payment_status: payment_status,
        amount: amount,
        sender: sender,
        reciever: reciever,
        reason: reason,
        reminder: 0,
        owner: email,
      });

      dispute.save();
    } else {
      dispute = await Dispute.findOneAndUpdate(
        { id: dispute_id },
        {
          $set: { updatedAt: new Date() },
          $inc: { reminder: 1 },
        }
      );
      remind = true;
    }

    return res.status(200).json({
      status: true,
      data: dispute,
      id: dispute_id_generated,
      reminded: remind,
    });
  } catch (error) {
    next(error);
  }
};

exports.FindDispute = async (req, res, next) => {
  const { id } = req.params;
  try {
    const findam = await Dispute.findOne({ dispute_id: id });
    if (!findam) {
      return next(new ErrorResponse("id does not exist", 201));
    }

    return res.status(200).json({ status: true, data: findam });
  } catch (error) {
    next(error);
  }
};

exports.CheckID = async (req, res, next) => {
  const { pay_id } = req.params;
  try {
    const user = await User.findOne(
      {
        paymentLink: {
          $elemMatch: { linkID: pay_id },
        },
      },
      { "paymentLink.$": 1 }
    );

    if (!user || user.paymentLink.length === 0) {
      return next(new ErrorResponse("id does not exist", 201));
    }

    return res.status(200).json({ status: true, data: user.paymentLink[0] });
  } catch (error) {
    next(error);
  }
};
