require("dotenv").config();
const express = require("express");
const user = require("./routes/user");
const admin = require("./routes/admin");
const auth = require("./routes/auth");
const payment = require("./routes/payment");
const referral = require("./routes/referrals");
const transaction = require("./routes/transaction");
const bene = require("./routes/beneficiaries");
const dispute = require("./routes/dispute");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const { ErrorHandler } = require("./middlewares/error");
const Logger = require("./middlewares/log");
const ErrorResponse = require("./utils/errorResponse");
const { User } = require("./models/Users");
const { Transaction } = require("./models/Transaction");
//const Notification = require("../models/Notification");
// const {
//   sendNotification,
// } = require("../utils/Notification/push-notification.service");
const { sendPaymentInfo } = require("./utils/email");
const crypto = require("crypto");
const { Notifications } = require("./models/Notifications");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.urlencoded({ extended: true }));

//parse application/json
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
// Logger middleware
app.use(Logger.logRequest);

const EndpointHead = process.env.Endpoint;

app.use(`${EndpointHead}/auth`, auth);
app.use(`${EndpointHead}/payment`, payment);
app.use(`${EndpointHead}/transaction`, transaction);
app.use(`${EndpointHead}/user`, user);
app.use(`${EndpointHead}/referral`, referral);
app.use(`${EndpointHead}/bene`, bene);
app.use(`${EndpointHead}/dispute`, dispute);
app.use(`${EndpointHead}/admin`, admin);

//Webhook Handling
app.post(`${EndpointHead}/webhook/Handle`, async function (req, res, next) {
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

    //This is for creadit (like depositing into an account)
    if (event === "transaction.new" && data.drcr === "CR") {
      const user = await User.findOne(
        {
          paymentLink: {
            $elemMatch: { issue_id: data.account_id },
          },
        },
        { "paymentLink.$": 1 }
      );

      // return res.status(200).json({ data: user });
      if (!user) return next(new ErrorResponse("No such user found", 401));

      const redeemCode = crypto.randomInt(100000, 1000000);

      //variables
      const returnTxStatus =
        user.paymentLink[0].incompletePaymentCount === 0 &&
        user.paymentLink[0].amount_created >
          parseFloat((data.amount / 100).toFixed(2))
          ? "pending"
          : user.paymentLink[0].incompletePaymentCount !== 0 &&
            user.paymentLink[0].amount_created >
              parseFloat((data.amount / 100).toFixed(2)) +
                user.paymentLink[0].amount_paid
          ? "pending"
          : data.status !== "successful"
          ? "failed"
          : "success";

      // const isInComplete = (user.paymentLink[0].incompletePaymentCount === 0 && user.paymentLink[0].amount_created >
      //   parseFloat((data.amount / 100).toFixed(2)) ) || (user.paymentLink[0].incompletePaymentCount !== 0 && user.paymentLink[0].amount_created > parseFloat((data.amount / 100).toFixed(2)) + user.paymentLink[0].amount_paid);

      const returnPaymentStatus =
        user.paymentLink[0].incompletePaymentCount === 0 &&
        user.paymentLink[0].amount_created >
          parseFloat((data.amount / 100).toFixed(2))
          ? "incomplete"
          : user.paymentLink[0].incompletePaymentCount !== 0 &&
            user.paymentLink[0].amount_created >
              parseFloat((data.amount / 100).toFixed(2)) +
                user.paymentLink[0].amount_paid
          ? "incomplete"
          : data.status !== "successful"
          ? "failed"
          : "complete";

      const amountPaid =
        user.paymentLink[0].incompletePaymentCount === 0
          ? parseFloat((data.amount / 100).toFixed(2))
          : parseFloat((data.amount / 100).toFixed(2)) +
            user.paymentLink[0].amount_paid;

      //update a user
      // 24 hours wait if the payment is cancelled
      let ToexpireIfIncomplete;
      if (returnPaymentStatus === "incomplete") {
        const twentyMins = 20 * 60 * 1000;
        ToexpireIfIncomplete = Date.now() + twentyMins; // Current timestamp + 30 minutes
      }

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
            "paymentLink.$.incompletePaymentCount":
              returnPaymentStatus === "incomplete" && 1,
          },
          $set: {
            "paymentLink.$.isPaid": returnPaymentStatus,
            ...(data.status === "successful" &&
              returnPaymentStatus === "complete" && {
                "paymentLink.$.redeemCode": redeemCode,
              }),
            "paymentLink.$.amount_paid": amountPaid,
            "paymentLink.$.payment_received": Date.now(),
            ...(returnPaymentStatus === "incomplete" && {
              "paymentLink.$.expired": ToexpireIfIncomplete,
            }),
          },
        },
        { new: true }
      );
      //update transaction
      await Transaction.findOneAndUpdate(
        { track_id: user.paymentLink[0].linkID },
        {
          $set: {
            status: returnTxStatus,
            "payment.isPaid": returnPaymentStatus,
            "payment.sender": {
              account_name: data.meta_data?.sender_account_name,
              account_number: data.meta_data?.sender_account_number,
            },
            "payment.amount_paid": amountPaid,
            ...(returnPaymentStatus === "incomplete" && {
              "payment.expired": ToexpireIfIncomplete,
            }),
          },
        },
        { new: true }
      );
      //return status
      // const returnStatus =
      //   user.paymentLink[0].incompletePaymentCount === 0 && user.paymentLink[0].amount_created > parseFloat((data.amount / 100).toFixed(2))
      //       ? "incomplete"
      //     : (user.paymentLink[0].incompletePaymentCount !== 0) && user.paymentLink[0].amount_created > parseFloat((data.amount / 100).toFixed(2)) + user.paymentLink[0].amount_paid
      //       ? "incomplete"
      //     : data.status === "successful" ? "failed"
      //     : "complete";

      // Emit socket event with data
      const emitData = {
        type: "Payment",
        payment: {
          sender: {
            account_number: data.meta_data?.sender_account_number,
            account_name: data.meta_data?.sender_account_name,
          },
          amount: amountPaid,
        },
        status:
          returnPaymentStatus === "complete"
            ? "success"
            : returnPaymentStatus === "incomplete"
            ? "incomplete"
            : "failed",
        amount_created: user.paymentLink[0].amount_created,
        amount_paid: amountPaid,
        id: user.paymentLink[0].linkID,
        transfer_id: data.reference,
        reciever: user.username,
        createdAt: data.created_at,
      };

      // Conditionally add infoR property for failed status
      if (data.status === "successful" && returnPaymentStatus === "complete") {
        emitData.infoR = redeemCode; // or replace with the appropriate reason
      } else {
        emitData.reason = returnPaymentStatus;
      }
      // So we return three sockets SuccessPay, IncompletePay, RepaymentPaysuccess,
      if (
        data.status === "successful" &&
        returnPaymentStatus === "complete" &&
        user?.paymentLink?.[0]?.incompletePaymentCount !== undefined &&
        user.paymentLink[0].incompletePaymentCount === 0
      ) {
        io.emit(`PaySuccess${data.account_id}`, emitData);
      } else if (
        returnPaymentStatus === "complete" &&
        data.status === "successful" &&
        user?.paymentLink?.[0]?.incompletePaymentCount !== undefined &&
        user.paymentLink[0].incompletePaymentCount !== 0
      ) {
        io.emit(`RepaymentPaySuccess${user.paymentLink[0].linkID}`, emitData);
      } else if (
        data.status === "successful" &&
        returnPaymentStatus === "incomplete" &&
        user?.paymentLink?.[0]?.linkID !== undefined
      ) {
        io.emit(`Incomplete${user.paymentLink[0].linkID}`, emitData);
      }

      //send push notification
      // notificationStatus = sendNotification(
      //   "Deposit",
      //   `Account deposit of ${data.amount} ${data.currency} was successful `,
      //   user.device_id,
      //   next
      // );

      const returnedData = redeemCode; //user.paymentLink.find( (one) => one.issue_id === data.account_id).redeemCode,
      const message = `Deposit ${returnPaymentStatus}`;

      //Send email to payee
      const info = `
        ${returnPaymentStatus === "complete" ? returnedData : 0}
      `;
      if (returnPaymentStatus === "complete") {
        sendPaymentInfo(info, user.paymentLink[0].sender_mail, next); //send message to their email
      }
      //return api call
      return res.status(200).json({
        status: true,
        message: message,
        data: returnPaymentStatus === "complete" ? returnedData : 0,
      });
    }

    //This is for debit, (like withdrawals)
    if (event === "transaction.updated" && data.drcr === "DR") {
      //flow here is to find tx, by track_id the get the user id and from there get the user
      // const tx = await Transaction.findOne({ track_id: data.reference });
      // const user = await User.findOne({ _id: tx?.sender.wallet });
      // if (!user) return next(new ErrorResponse("No such user found", 401));
      //update created transaction
      const txupdate = await Transaction.findOneAndUpdate(
        { track_id: data.reference },
        {
          $set: {
            status: data.status === "successful" ? "success" : "failed",
          },
        },
        { new: true }
      );
      //if withdraw fails, recredit user
      if (data.status !== successful) {
        await User.findOneAndUpdate(
          { _id: txupdate.owner },
          {
            $inc: { "balances.main_wallet": parseFloat(data.amount / 100) }, // increment the balance
          },
          { new: true }
        );
      }

      //send push notification
      //   notificationStatus = sendNotification(
      //     "Deposit",
      //     `Account Withdrawal of ${data.amount} ${data.currency}  ${
      //       data.status === "successful" ? " was successful " : "failed"
      //     } `,
      //     user.device_id,
      //     next
      //   );

      if (data.status === "successful") {
        io.emit(`WithdrawalSuccess${data.reference}`);
      } else {
        io.emit(`WithdrawalFailed${data.reference}`);
      }

      const message = `Withdrawaal ${
        data.status === "successful" ? "successful" : "failed"
      }`;
      return res.status(200).json({
        status: true,
        message: message,
      });
    }
  } catch (err) {
    next(err);
  }
});

// Error handler middleware
app.use(ErrorHandler);

//ini my database
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "PayBService",
  })
  .then(() => {
    console.log("Database Connection is ready...");
  })
  .catch((err) => {
    console.log(err);
  });

server.listen(8000, function () {
  console.log(`App is Listening http://localhost:8000${EndpointHead}`);
});
