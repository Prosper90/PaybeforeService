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
const webhook = require("./routes/webhook");
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
console.log(typeof EndpointHead);

app.use(`${EndpointHead}/auth`, auth);
app.use(`${EndpointHead}/payment`, payment);
app.use(`${EndpointHead}/transaction`, transaction);
app.use(`${EndpointHead}/user`, user);
app.use(`${EndpointHead}/referral`, referral);
app.use(`${EndpointHead}/bene`, bene);
app.use(`${EndpointHead}/dispute`, dispute);
app.use(`${EndpointHead}/admin`, admin);
// app.use(`${EndpointHead}/webhook`, webhook);

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
        user.paymentLink[0].incompletePaymentCount === 0
          ? user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2))
            ? "pending"
            : "success"
          : user.paymentLink[0].incompletePaymentCount !== 0
          ? user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
            ? "pending"
            : "success"
          : data.status !== "successful" && "failed";

      const returnPaymentStatus =
        user.paymentLink[0].incompletePaymentCount === 0
          ? user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2))
            ? "incomplete"
            : "complete"
          : user.paymentLink[0].incompletePaymentCount !== 0
          ? user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
            ? "incomplete"
            : "complete"
          : data.status !== "successful" && "failed";

      const amountPaid =
        user.paymentLink[0].incompletePaymentCount === 0
          ? parseFloat((data.amount / 100).toFixed(2))
          : parseFloat((data.amount / 100).toFixed(2)) +
            user.paymentLink[0].amount_paid;

      // console.log(data.amount, "checking the amount sent");
      //update a user
      await User.findOneAndUpdate(
        {
          _id: user._id,
          "paymentLink.issue_id": data.account_id,
        },
        {
          $inc: {
            "balances.pending_wallet": parseFloat((data.amount / 100).toFixed(2)),
          },
          $set: {
            "paymentLink.$.isPaid": (() => {
              const amountPaid = parseFloat((data.amount / 100).toFixed(2));
              const amountCreated = user.paymentLink[0].amount_created;
              const amountPreviouslyPaid = user.paymentLink[0].amount_paid;
              const isComplete = user.paymentLink[0].incompletePaymentCount === 0;
              const isSuccessful = data.status === "successful";
      
              // Logic to determine isPaid value
              let isPaid;
              if (isComplete) {
                isPaid = "complete";
              } else if (amountCreated <= amountPreviouslyPaid + amountPaid) {
                isPaid = "complete";
              } else {
                isPaid = "incomplete";
              }
      
              return isPaid;
            })(),
            "paymentLink.$.redeemCode": redeemCode,
            "paymentLink.$.amount_paid": amountPaid,
            "paymentLink.$.payment_received": Date.now(), // Corrected spelling
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
              account_name: data.meta_data.sender_account_name,
              account_number: data.meta_data.sender_account_number,
            },
            "payment.amount_paid": amountPaid,
          },
        },
        { new: true }
      );

      //return status
      const returnStatus =
        user.paymentLink[0].incompletePaymentCount === 0
          ? user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2))
            ? "incomplete"
            : "complete"
          : user.paymentLink[0].incompletePaymentCount !== 0
          ? user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
            ? "incomplete"
            : "complete"
          : data.status === "successful" && "failed";

      // Emit socket event with data
      const emitData = {
        type: "Payment",
        payment: {
          sender: {
            account_number: data.meta_data.sender_account_number,
            account_name: data.meta_data.sender_account_name,
          },
          amount: amountPaid,
        },
        status:
          returnStatus === "complete"
            ? "success"
            : returnStatus === "incomplete"
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
      if (data.status === "successful" && returnStatus === "complete") {
        emitData.infoR = redeemCode; // or replace with the appropriate reason
      } else {
        emitData.reason = returnStatus;
      }

      io.emit(`Pay${data.account_id}`, emitData);

      // console.log(`Pay${data.account_id}`, emitData);

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
        ${message}
        Reedem code ${returnPaymentStatus === "complete" ? returnedData : 0}
      `
      sendPaymentInfo(info, user.paymentLink[0].sender_mail, next); //send message to their email
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
      console.log(data.status, "checking something");
      //update created transaction
      await Transaction.findOneAndUpdate(
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
