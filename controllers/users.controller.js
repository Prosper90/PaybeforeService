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
  const link = `http://localhost:5173/reset-password/?token=${token}&user=${user._id}`;
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
      res.status(200).json({ status: true, data: updatePassword });
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
  if (req.body.first_name) objForUpdate.first_name = req.body.first_name;
  if (req.body.last_name) objForUpdate.last_name = req.body.last_name;
  if (req.body.bank_name) objForUpdate.bank_info.bank_name = req.body.bank_name;
  if (req.body.account_number)
    objForUpdate.bank_info.bank_name = req.body.bank_name;

  try {
    await User.findOneAndUpdate(
      { _id: req.user._id },
      { $set: objForUpdate },
      { new: true }
    );

    res.status(200).json({ status: true, message: "Customer updated" });
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
    await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $inc: { "balances.main_wallet": -amount }, // Decrement the balance
      },
      { new: true }
    );

    //We create a transaction
    const transaction = new Transaction({
      type: "withdrawal",
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

    const transferUrl = `${process.env.LOCAL_BASE}/v1/transfers/balance`;
    // Define the request headers and data
    const headers = generateLocalHeader(next);
    // Generate headers
    const ref = `${req.user._id}${Math.floor(Math.random() * amount)}`;
    //request body for transfer
    const RequestDataTransfer = {
      amount: amount * 100,
      bank_code: bank_code,
      account_number: account_number,
      narration: description,
      reference: ref,
    };

    //call the transfer endpoint
    const responseTransfer = await makecall(
      transferUrl,
      RequestDataTransfer,
      headers,
      "post",
      next
    );
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

      //update transaction
      await Transaction.findByIdAndUpdate(
        { _id: transaction._id },
        { $set: { status: "failed" } },
        { new: true }
      );

      return next(
        new ErrorResponse(`Account ${responseTransfer.message}`, 401)
      );
    }

    //get the values of the api result out
    const values = responseTransfer.data;

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
    return res.status(200).json({ status: true, data: values });
  } catch (error) {
    next(error);
  }
};
