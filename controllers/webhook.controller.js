const ErrorResponse = require("../utils/errorResponse");
const { User } = require("../models/Users");
const { Transactions } = require("../models/Transaction");
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

    //This is for creadit (like depositing into an account)
    if (event === "transaction.new" && data.drcr === "CR") {
      console.log("data one");
      const user = await User.findOne({ local_id: data.customer_id });
      if (!user) return next(new ErrorResponse("No such user found", 401));
      console.log("data two", user);
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

      //update a user
      await User.findOneAndUpdate(
        {
          _id: user._id,
          "paymentLink.isPaid": false,
        },
        {
          $inc: {
            "balances.pending_wallet": parseFloat(
              (data.amount / 100).toFixed(2)
            ),
          },
          $set: { "paymentLink.$.isPaid": true },
          $push: { recent_transactions: transaction._id },
        },
        { new: true }
      );
      //send push notification
      // notificationStatus = sendNotification(
      //   "Deposit",
      //   `Account deposit of ${data.amount} ${data.currency} was successful `,
      //   user.device_id,
      //   next
      // );

      message = `Deposit ${
        data.status === "successful" ? "successful" : "failed"
      }`;
    }

    //This is for debit, (like withdrawals)
    if (event === "transaction.new" && data.drcr === "DR") {
      const user = await User.findOne({ local_id: data.customer_id });
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

    //This is for documents (specifically, kyc upgrade)
    if (event === "customer.kyc.upgraded.t1") {
      const user = await User.findOne({ bvn: data.bvn });
      if (!user) return next(new ErrorResponse("No user found", 401));

      if (data.kyc_tier !== "1" && user.kyc === "1") {
        console.log("Found this one");
        await User.findOneAndUpdate(
          { _id: user._id },
          { $set: { kyc: data.kyc_tier } },
          { new: true }
        );
      }

      if (data.kyc_tier === "1" && user.kyc !== "1") {
        console.log("Found this one two");
        await User.findOneAndUpdate(
          { _id: user._id },
          { $set: { kyc: "2" } },
          { new: true }
        );
      }

      //send Notification
      const newNotify = new Notifications({
        type: "Documents",
        message:
          data.kyc === "2"
            ? "Documents Verified"
            : "Documents verification failed",
      });
      await newNotify.save();
      //send push notification
      // notificationStatus = sendNotification(
      //   "Documents",
      //   ` ${
      //     data.kyc_tier === "2"
      //       ? "Documents verification successfull"
      //       : "Documents verification failed"
      //   }`,
      //   user.device_id,
      //   next
      // );

      message = `Documents ${
        data.kyc_tier === "2" ? "Verified" : "Verification failed"
      }`;
    }

    return res.status(200).json({
      status: true,
      message: message,
    });
  } catch (err) {
    next(err);
  }
};
