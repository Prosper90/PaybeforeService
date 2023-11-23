require("dotenv").config();
const bcrypt = require("bcrypt");
const { sendResponseWithToken } = require("../utils/handleResponse");
const { makecall } = require("../utils/makeRequest");
const crypto = require("crypto");
const ErrorResponse = require("../utils/errorResponse.js");
const { generateLocalHeader } = require("../utils/genHeadersData");
const { sendOtp } = require("../utils/sendOtp");
//const client = new twilio(process.env.TwilloaccountSid, process.env.TwilloauthToken);
const { v4: uuidv4 } = require("uuid");
const { User } = require("../models/Users");
const { createToken } = require("../utils/createTokens");

//First entry onboarding
//Resend Auth
exports.RegisterWithOtp = async (req, res, next) => {
  const { email } = req.body;

  const userCheck = await User.findOne({ email: req.body.email });
  if (userCheck) {
    return next(
      new ErrorResponse("User aleady exists, verify account to continue", 401)
    );
  }
  try {
    const otp = crypto.randomInt(100000, 1000000); // Generates a 7-character OTP
    // Calculate the OTP expiration time (e.g., 5 minutes from now)
    const Expire = Date.now() + 5 * 60 * 1000; // Current timestamp + 300 seconds (5 minutes)
    let user = new User({
      email: email,
      otp: otp,
      otpExpire: Expire,
    });
    user = await user.save();

    const sent = await sendOtp("email", otp, req.body.email, next);
    console.log(sent, "checking upon depoying");
    if (!sent.status) return next(new ErrorResponse(sent.message, 401));
    return res.status(200).json({ status: true, message: "otp sent" });
  } catch (error) {
    next(error);
  }
};

//Resend Auth
exports.ResendOtp = async (req, res, next) => {
  console.log("11111111111");
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ErrorResponse("No Token", 401));
  }
  try {
    const otp = crypto.randomInt(100000, 1000000); // Generates a 7-character OTP
    // Calculate the OTP expiration time (e.g., 5 minutes from now)
    const Expire = Date.now() + 5 * 60 * 1000; // Current timestamp + 300 seconds (5 minutes)
    await User.findOneAndUpdate(
      { _id: user._id },
      { $set: { otp: otp, otpExpire: Expire } }
    );

    const sent = await sendOtp("email", otp, req.body.email, next);
    if (!sent.status) return next(new ErrorResponse(sent.message, 401));

    res.status(200).json({ status: true, message: "otp Resent" });
  } catch (error) {
    next(error);
  }
};

//Verify otp
exports.VerifyOtpSignUp = async (req, res, next) => {
  //console.log(req.user);
  //send Otp to req.body.number
  const otpRecieved = req.body.otp;
  console.log(otpRecieved, "checkers");
  const user = await User.findOne({ otp: otpRecieved });
  if (!user) {
    return next(new ErrorResponse("No User exist", 401));
  }

  try {
    if (user.otp !== otpRecieved) {
      return next(new ErrorResponse("Invalid token", 401));
    }

    const currentTimestamp = Date.now(); // Current timestamp in seconds
    const otpExpireTimestamp = Date.parse(user.otpExpire); // Convert otpExpire to a timestamp
    if (currentTimestamp > otpExpireTimestamp) {
      return next(new ErrorResponse("OTP has expired", 401));
    }

    await User.findOneAndUpdate(
      { otp: otpRecieved },
      { $set: { isVerified: true } },
      { new: true } // Set this to true to return the updated document
    );

    res.status(200).json({ status: true, message: "User verified" });
  } catch (error) {
    next(error);
  }
};

// users creates account header
// before storing to the database
exports.CreateAccount = async (req, res, next) => {
  const { first_name, last_name, phone_number, email, password } = req.body;

  try {
    //Add checks for some other things

    const userCheck = await User.findOne({ email: email });
    if (!userCheck) return next(new ErrorResponse("User not found", 401));

    if (userCheck.isVerified === false)
      return next(new ErrorResponse("User is not verified", 401));

    //Hashing passwords and referrals
    const salt = await bcrypt.genSalt();
    const hashedpassword = await bcrypt.hash(password, salt);
    const refID = crypto.randomInt(100000, 1000000);

    const user = await User.findOneAndUpdate(
      { _id: userCheck },
      {
        $set: {
          first_name: first_name,
          last_name: last_name,
          phone_number: phone_number,
          full_name: `${last_name} ${first_name}`,
          email: email,
          balances: {
            main_wallet: 0,
            pending_wallet: 0,
            refferal_wallet: 0,
          },
          country: "NG",
          password: hashedpassword,
          userReferralID: refID,
        },
      },
      { new: true }
    );

    //adding to user referrer
    const findRef = await User.findOne({ userReferralID: req.query.ref });
    if (findRef) {
      await User.findOneAndUpdate(
        { userReferralID: req.params.ref },
        {
          $push: {
            referringUserIDs: user._id,
          },
        },
        { new: true }
      );
    }

    return res.status(200).json({ status: true, data: user });
  } catch (error) {
    // Call handleErrors function
    next(error);
  }
};

exports.loginUser = async (req, res, next) => {
  console.log(req.body, "Hello here");
  const { email, password } = req.body;

  try {
    const user = await User.login(email, password, next);

    const token = createToken(user._id);
    //sendResponseWithToken(res, 200, { success: true, data: user }, token);
    return res.status(200).json({ status: true, data: user, token: token });
  } catch (err) {
    next(err);
  }
};
