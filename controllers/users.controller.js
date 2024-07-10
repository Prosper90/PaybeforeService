const bcrypt = require("bcrypt");
const { makecall } = require("../utils/makeRequest");
const ErrorResponse = require("../utils/errorResponse.js");
const { User } = require("../models/Users");
const jwt = require("jsonwebtoken");
const { sendPasswordEmail } = require("../utils/email");
const { Transaction } = require("../models/Transaction");
const { generateLocalHeader } = require("../utils/genHeadersData");

/*
 * This is to request change if the user forgets their password
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
    const verifyUrl = `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOCAL_SECRET_TWO}`,
      accept: "application/json",
    };
    const gotten = await makecall(verifyUrl, {}, headers, "get", next);
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

    const transferUrl = `${process.env.LOCAL_BASE}v1/transfers/balance`;
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
    //call the transfer endpoint
    const responseTransfer = await makecall(
      transferUrl,
      RequestDataTransfer,
      headers,
      "post",
      next
    );
    if (!responseTransfer?.success) {
      return next(
        new ErrorResponse(`Account ${responseTransfer?.message}`, 401)
      );
    }

    //get the values of the api result out
    const values = responseTransfer.data;

    //We create a transaction
    const transaction = new Transaction({
      type: "Withdrawal",
      withdrawal: {
        amount: amount,
        sender: req.user._id,
        reciever: {
          account_name: account_name,
          account_number: account_number,
        },
        description: description,
      },
      owner: req.user.id,
      status: "pending",
      track_id: values.reference,
    });

    await transaction.save();

    // Debit user
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $inc: { "balances.main_wallet": -amount }, // Decrement the balance
        $push: { recent_transactions: transaction._id },
      },
      { new: true }
    );

    return res.status(200).json({
      status: true,
      data: values.reference,
      message: "withdrawal successfull",
    });
  } catch (error) {
    next(error);
  }
};
