const ErrorResponse = require("../utils/errorResponse");
const { User } = require("../models/Users");
const { Transactions } = require("../models/Transaction");
const io = require("socket.io")();
//const Notification = require("../models/Notification");
// const {
//   sendNotification,
// } = require("../utils/Notification/push-notification.service");
const crypto = require("crypto");
const { Notifications } = require("../models/Notifications");

// User updates their avatar
exports.Hooks = async (req, res, next) => {
  //validate event
  // const hash = crypto
  //   .createHmac("sha256", webhook_secret)
  //   .update(JSON.stringify(req.body))
  //   .digest("hex");
  // if (hash !== req.headers["X-Bloc-Webhook"])
  //   return next(new ErrorResponse("Request not from blockq", 400));
  // Retrieve the request's body

  try {
    const { event, data } = req.body;
    let message;
    let returnedData;

    //This is for creadit (like depositing into an account)
    if (event === "transaction.new" && data.drcr === "CR") {
      const user = await User.findOne({
        paymentLink: {
          $elemMatch: { issue_id: data.account_id },
        },
      });
      const recieverInfo = user.paymentLink.find((dataPayment) => {
        return dataPayment.issue_id == data.account_id;
      });
      if (!user) return next(new ErrorResponse("No such user found", 401));
      //create a new transaction
      const transaction = new Transactions({
        type: "Deposit",
        "sender.bank": {
          beneficiary_bank_name: data.meta_data.sender_bank_name,
          beneficiary_name: data.meta_data.sender_account_name,
        },
        amount: req.body.data.amount,
        currency: req.body.data.currency,
        "reciever.wallet": user._id,
        status: "success",
        track_id: data.reference,
      });

      transaction.save();

      const redeemCode = crypto.randomInt(100000, 1000000);

      //update a user
      await User.findOneAndUpdate(
        {
          _id: user._id,
          "paymentLink.issue_id": data.account_id,
        },
        {
          $inc: {
            "balances.pending_wallet": parseFloat(
              (data.amount / 100).toFixed(2)
            ),
          },
          $set: {
            "paymentLink.$.isPaid": true,
            "paymentLink.$.redeemCode": redeemCode,
          },
          $push: { recent_transactions: transaction._id },
        },
        { new: true }
      );
      //Emit socket event
      io.on("connection", (socket) => {
        // Emit event with data
        socket.emit(`Payment${data.account_id}`, {
          info: `${data.amount} paid`,
          message: `${
            req.body.data.amount >= recieverInfo.amount
              ? "Payment complete"
              : "Incomplete payment"
          }`,
        });
      });

      //send push notification
      // notificationStatus = sendNotification(
      //   "Deposit",
      //   `Account deposit of ${data.amount} ${data.currency} was successful `,
      //   user.device_id,
      //   next
      // );

      returnedData = redeemCode; //user.paymentLink.find( (one) => one.issue_id === data.account_id).redeemCode,
      message = `Deposit ${
        data.status === "successful" ? "successful" : "failed"
      }`;
    }

    //This is for debit, (like withdrawals)
    if (event === "transaction.new" && data.drcr === "DR") {
      //flow here is to find tx, by track_id the get the user id and from there get the user
      const tx = await User.findOne({ track_id: data.reference });
      const user = await User.findOne({ _id: tx.sender.wallet });
      if (!user) return next(new ErrorResponse("No such user found", 401));

      //update created transaction
      await Transactions.findByIdAndUpdate(
        { track_id: data.reference },
        {
          $set: {
            status: data.status === "successful" ? "success" : "failed",
          },
        },
        { new: true }
      );

      //send push notification
      //   notificationStatus = sendNotification(
      //     "Deposit",
      //     `Account Withdrawal of ${data.amount} ${data.currency}  ${
      //       data.status === "successful" ? " was successful " : "failed"
      //     } `,
      //     user.device_id,
      //     next
      //   );

      message = `Withdrawaal ${
        data.status === "successful" ? "successful" : "failed"
      }`;
    }

    return res.status(200).json({
      status: true,
      message: message,
      data: returnedData,
    });
  } catch (err) {
    next(err);
  }
};
