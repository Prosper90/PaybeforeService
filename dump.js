$set: {
    "paymentLink.$.isPaid":
      user.paymentLink[0].amount_created >
      parseFloat((data.amount / 100).toFixed(2))
        ? "incomplete"
        : user.paymentLink[0].complete !== 0 &&
          user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
        ? "incomplete"
        : data.status !== "successful"
        ? "failed"
        : user.paymentLink[0].complete !== 0 &&
          user.paymentLink[0].amount_created <=
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
        ? "complete"
        : "complete",
    "paymentLink.$.redeemCode": redeemCode,
    "paymentLink.$.amount_paid": parseFloat(
      (data.amount / 100).toFixed(2)
    ),
  },




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

      // console.log(returnTxStatus, "tx status");

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

      // console.log(returnPaymentStatus, "payments status");

      const amountPaid =
        user.paymentLink[0].incompletePaymentCount === 0
          ? parseFloat((data.amount / 100).toFixed(2))
          : parseFloat((data.amount / 100).toFixed(2)) +
            user.paymentLink[0].amount_paid;

      // console.log(amountPaid, "amount paid");

      // console.log(user.paymentLink[0].incompletePaymentCount, "opening here sharp");

      // console.log(data.amount, "checking the amount sent");
      //update a user
      // 24 hours wait if the payment is cancelled
      let expire;
      if (returnPaymentStatus === "incomplete") {
        const twentyMins = 20 * 60 * 1000;
        expire = Date.now() + twentyMins; // Current timestamp + 30 minutes
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
            "paymentLink.$.redeemCode": redeemCode,
            "paymentLink.$.amount_paid": amountPaid,
            "paymentLink.$.payment_received": Date.now(),
            ...(returnPaymentStatus === "incomplete" && {
              "paymentLink.$.expired": expire,
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
              account_name: data.meta_data.sender_account_name,
              account_number: data.meta_data.sender_account_number,
            },
            "payment.amount_paid": amountPaid,
            ...(returnPaymentStatus === "incomplete" && {
              "payment.expired": expire,
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
            account_number: data.meta_data.sender_account_number,
            account_name: data.meta_data.sender_account_name,
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
      // console.log(`Pay${data.account_id}`, emitData);

      if (returnPaymentStatus === "incomplete") {
        io.emit(`Pay${user.paymentLink[0].linkID}`, emitData);
      } else {
        io.emit(`Pay${data.account_id}`, emitData);
      }

      // console.log("after emmiting all done");
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
      // console.log(data.status, "checking something");
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











///workings
const bcrypt = require("bcrypt");
const { randomInt } = require("crypto");
const { makecall } = require("../utils/makeRequest");
const crypto = require("crypto");
const ErrorResponse = require("../utils/errorResponse.js");
const { User } = require("../models/Users");
const jwt = require("jsonwebtoken");
const { sendPasswordEmail } = require("../utils/email");
const { Transaction } = require("../models/Transaction");
const { generateLocalHeader } = require("../utils/genHeadersData");
const { generateRandomAlphaNumeric } = require("../utils/createTokens.js");

/*
 * this is to request change if the user forgets their password
 *
 */
exports.ForgetPasswordRequest = async (req, res, next) => {
  const { email } = req.params;
  const user = await User.findOne({ email: email }).select("+password");
  if (!user) return next(new ErrorResponse("user does not exist", 401));
  const secret = process.env.JWT_SECRET + user.password;
  const payload = {
    email: user.email,
    id: user._id,
  };
  const token = jwt.sign(payload, secret, { expiresIn: "1h" }); // Set the expiration time as needed
  const link = `${req.protocol}://${req.host}/reset-password/?token=${token}&user=${user._id}`;
  sendPasswordEmail(link, email);
  res.status(200).json({ status: true, message: "email sent" });
};

/**
 * this is to update password after requesting
 *
 */
exports.ForgetPasswordUpdate = async (req, res, next) => {
  const { new_password, token, user_Id } = req.body;
  try {
    const user = await User.findOne({ _id: user_Id }).select("+password");
    if (!user) return next(new ErrorResponse("User doesnt exist", 401));
    jwt.verify(
      token,
      process.env.JWT_SECRET + user.password,
      async (err, decodedToken) => {
        if (err) {
          return next(new ErrorResponse("invalid token", 401));
        } else {
          const salt = await bcrypt.genSalt();
          const hash = await bcrypt.hash(new_password, salt);
          const user = await User.findOneAndUpdate(
            { _id: decodedToken.id },
            {
              $set: { password: hash },
            },
            { new: true }
          );
          // Handle success case
          if (user) return res.status(200).json({ status: true, data: user });
        }
      }
    );
  } catch (error) {
    // Handle error case
    next(error);
  }
};

/**
 * this is to update the user password
 *
 */
exports.UpdatePassword = async (req, res, next) => {
  const { old_password, new_password } = req.body;

  try {
    const checkUser = await User.findById({ _id: req.user._id }).select(
      "+password"
    );
    if (!checkUser) return next(new ErrorResponse("No user found", 401));
    // compare passwords
    const comparepass = await bcrypt.compare(old_password, checkUser.password);
    if (!comparepass)
      return next(new ErrorResponse("Old password doesnt match", 401));

    const salt = await bcrypt.genSalt();
    const hashedpassword = await bcrypt.hash(new_password, salt);
    const updatePassword = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $set: { password: hashedpassword },
      },
      { new: true }
    );

    if (updatePassword)
      res.status(200).json({
        status: true,
        data: updatePassword,
        message: "Password updated",
      });
  } catch (error) {
    next(error);
  }
};

/**
 * this is to update the user pin
 *
 */
exports.UpdatePin = async (req, res, next) => {
  const { old_pin, new_pin } = req.body;

  try {
    const checkUser = await User.findById({ _id: req.user._id });
    if (!checkUser) return next(new ErrorResponse("No user found", 401));
    // compare passwords
    const comparepin = old_pin === checkUser.pin;
    if (!comparepin)
      return next(new ErrorResponse("Old pin doesnt match", 401));

    const updatePin = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $set: { pin: new_pin },
      },
      { new: true }
    );

    if (updatePin)
      res
        .status(200)
        .json({ status: true, data: updatePin, message: "Pin updated" });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Profile
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.GetProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "recent_transactions"
    );
    if (!user) {
      return next(new ErrorResponse(`user not found.`, 401));
    }
    res.status(200).json({ status: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * this route is to update user profile
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.updateProfile = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new ErrorResponse(`user not found.`, 401));
  }

  var objForUpdate = {};

  if (req.body.email) objForUpdate.email = req.body.email;
  if (req.body.username) objForUpdate.username = req.body.username;
  if (req.body.full_name) objForUpdate.full_name = req.body.full_name;
  if (req.body.address) objForUpdate.address = req.body.address;
  if (req.body.city) objForUpdate.city = req.body.city;
  if (req.body.state) objForUpdate.state = req.body.state;
  if (req.body.location) objForUpdate.location = req.body.location;
  if (req.body.phone_number) objForUpdate.phone_number = req.body.phone_number;

  try {
    const updateduser = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $set: objForUpdate },
      { new: true }
    );

    res
      .status(200)
      .json({ status: true, data: updateduser, message: "Profile updated" });
  } catch {
    next(error);
  }
};

exports.AccountName = async (req, res, next) => {
  const { account_number, bank_code } = req.params;
  try {
    console.log(account_number, bank_code, "checks ooo");
    const verifyUrl = `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`;
    console.log(verifyUrl, "checks");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOCAL_SECRET_TWO}`,
      accept: "application/json",
    };
    const gotten = await makecall(verifyUrl, {}, headers, "get", next);
    console.log(gotten, "gotten");
    if (!gotten?.status) {
      return next(new ErrorResponse("Couldnt get account name"));
    }

    return res.status(200).json({ status: true, data: gotten });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Profile
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.withdraw = async (req, res, next) => {
  const {
    account_number,
    account_name,
    bank_name,
    bank_code,
    currency,
    amount,
    description,
    duplicate_id,
  } = req.body;

  try {
    //check for duplicate_id
    console.log(req.body, "LLLLLLLLLLLLMMMMMMMMMM");
    // const duplicate = await Transactions.findOne({
    //   duplicate_id: duplicate_id,
    // });
    // if (duplicate) return next(new ErrorResponse("duplicate transaction", 401));
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse(`user not found.`, 401));
    }
    if (user.balances.main_wallet < amount)
      return next(new ErrorResponse("insufficient funds", 401));

    // Debit user
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $inc: { "balances.main_wallet": -amount }, // Decrement the balance
      },
      { new: true }
    );

    //We create a transaction
    const transaction = new Transaction({
      type: "Withdrawal",
      withdrawal: {
        amount: amount,
        sender: req.user._id,
        reciever: {
          account_name: account_name,
          account_number: account_number,
          // beneficiary_bank_name: bank_name,
          // beneficiary_bank_code: bank_code,
        },
        description: description,
      },
      owner: req.user.id,
      status: "pending",
    });

    await transaction.save();

    const transferUrl = `${process.env.LOCAL_BASE}v1/transfers/balance`;
    console.log(process.env.LOCAL_BASE, transferUrl, "urfl transfers");
    // Define the request headers and data
    const headers = generateLocalHeader(next);
    // Generate headers
    const ref = `${req.user._id}${Math.floor(Math.random() * amount)}`;
    //request body for transfer
    const RequestDataTransfer = {
      amount: Math.floor(amount * 100),
      bank_code: bank_code,
      account_number: account_number,
      narration: description,
      reference: ref,
    };
    console.log(RequestDataTransfer, "Requesssssssssst data transfer");
    //call the transfer endpoint
    const responseTransfer = await makecall(
      transferUrl,
      RequestDataTransfer,
      headers,
      "post",
      next
    );
    console.log(responseTransfer, "checkings");
    if (!responseTransfer?.success) {
      //Refund user
      await User.findOneAndUpdate(
        { _id: req.user._id },
        {
          $inc: { "balances.main_wallet": amount }, // increment the balance
          $push: { recent_transactions: transaction._id },
        },
        { new: true }
      );

      //check if there is pending and if there is, check if the account can take the withdrawal
      //if it can push in the object else throw error saying inisufficient funds
      const checkForPendingWithdrawal = await User.findOne(
        {
          withdrawalIssued: {
            $elemMatch: { withrawal_requested: true },
          },
        },
        { "withdrawalIssued.$": 1 }
      );

      console.log(checkForPendingWithdrawal, "checking the monster");
      const ref = generateRandomAlphaNumeric(6); //this is to generate track id to know unique payment aside mongodb _id

      if (
        checkForPendingWithdrawal &&
        checkForPendingWithdrawal.withdrawalIssued.length > 0
      ) {
        const totalWithdrawing =
          checkForPendingWithdrawal.withdrawalIssued.reduce(
            (total, withdrawal) => total + withdrawal.withdrawal_Amount,
            0
          ) + amount;
        if (user.balances.main_wallet < totalWithdrawing) {
          return next(new ErrorResponse(`Insufficient funds.`, 401));
        }
      }

      let newWithdrawal = {
        withrawal_requested: true,
        withdrawal_Amount: amount,
        bank_name: bank_name,
        account_number: account_number,
        account_name: account_name,
        track_id: ref,
        status: "pending",
      };
      //call manual withdrawal
      await User.findOneAndUpdate(
        { _id: req.user._id },
        {
          $push: { withdrawalIssued: newWithdrawal },
        },
        { new: true }
      );

      //update transaction
      await Transaction.findByIdAndUpdate(
        { _id: transaction._id },
        { $set: { status: "pending", track_id: ref } },
        { new: true }
      );

      // return next(
      //   new ErrorResponse(`Account ${responseTransfer?.message}`, 401)
      // );
      return res
        .status(200)
        .json({ status: true, message: "Withdrawal Request recieved" });
    }

    //get the values of the api result out
    const values = responseTransfer.data;

    console.log(values, "checking values out ooooo");

    //update user recent_transaction
    await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $push: { recent_transactions: transaction._id },
      },
      { new: true }
    );

    //update transaction
    await Transaction.findByIdAndUpdate(
      { _id: transaction._id },
      { $set: { track_id: values.reference } },
      { new: true }
    );

    //send and create notification
    //sendNotification("Local transfer", "testing", req.user.device_id, next);
    // const newNotify = new Notification({
    //   title: `local transfer`,
    //   message: `your local transfer to is successful`,
    //   url: "sampleurl",
    //   transactionId: transaction._id,
    // });
    // await newNotify.save();
    return res.status(200).json({
      status: true,
      data: updatedUser,
      message: "withdrawal successfull",
    });
  } catch (error) {
    next(error);
  }
};
