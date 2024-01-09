require("dotenv").config();
const ErrorResponse = require("../utils/errorResponse.js");
const { Transaction } = require("../models/Transaction");
const { Dispute } = require("../models/Dispute.js");
const { generateRandomAlphaNumeric } = require("../utils/createTokens.js");

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
      dispute_id,
      reason,
      type,
      sender,
      reciever,
      payment_status,
      amount,
    } = req.body;
    const findDispute = await Dispute.findOne({ id: dispute_id });
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
        reason: reason,
        reminder: 0,
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

    return res
      .status(200)
      .json({
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
