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
// exports.updateVerifyProfile = async (req, res, next) => {
//   const {
//     first_name,
//     last_name,
//     address,
//     state,
//     city,
//     bvn,
//     date_of_birth,
//     face_image,
//     zip,
//     phone_number,
//   } = req.body;

//   try {
//     //Add checks for some other things
//     //check if the user is verified
//     let user;
//     let customerData;
//     let identityData;
//     let virtualAccountData;

//     const userCheck = await User.findOne({ _id: req.user._id });
//     user = userCheck;
//     if (!userCheck) return next(new ErrorResponse("User not found", 401));
//     // //convert date
//     const originalDate = date_of_birth;
//     const dateObject = new Date(originalDate);
//     const year = dateObject.getUTCFullYear();
//     const month = `0${dateObject.getUTCMonth() + 1}`.slice(-2);
//     const day = `0${dateObject.getUTCDate()}`.slice(-2);
//     const formattedDate = `${year}-${month}-${day}`;

//     const createCustomerApiUrl = `${process.env.LOCAL_BASE}v1/customers`;

//     const headersLocal = generateLocalHeader();

//     // Create a customer on third party request body
//     const CustomerRequestData = {
//       email: req.user.email,
//       phone_number: phone_number,
//       bvn: bvn,
//       first_name: first_name,
//       last_name: last_name,
//       customer_type: "Personal",
//     };

//     //make  local call
//     //create a customer //check if user has an account already maybe experieneced issue with network
//     if (!userCheck.local_id) {
//       const responseLocalCreateCustomer = await makecall(
//         createCustomerApiUrl,
//         CustomerRequestData,
//         headersLocal,
//         "post",
//         next
//       );

//       if (!responseLocalCreateCustomer.success) {
//         return next(
//           new ErrorResponse(responseLocalCreateCustomer.message, 400)
//         );
//       }
//       customerData = responseLocalCreateCustomer.data;
//       //Hashing passwords and referrals

//       user = await User.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             local_id: customerData?.id,
//             bvn: bvn,
//             address: address,
//             city: city,
//             state: state,
//             country: "NG",
//             date_of_birth: req.user.date_of_birth,
//             phone_number: phone_number,
//           },
//         },
//         { new: true }
//       );
//     }

//     const verifyIdentityApiUrl = `${process.env.LOCAL_BASE}/v1/customers/upgrade/t1/${user.local_id}`;
//     const createVirtualAccountApiUrl = `${process.env.LOCAL_BASE}/v1/accounts`;

//     //Verify Identity request body
//     const VerifyIdentityRequestData = {
//       place_of_birth: state,
//       dob: formattedDate,
//       gender: req.user.gender,
//       country: "Nigeria",
//       address: {
//         street: address,
//         city: city,
//         state: state,
//         country: "NG",
//         postal_code: zip,
//       },
//       image: face_image,
//     };

//     //Create a virtual account request body
//     const VirtualAccountRequestData = {
//       customer_id: user.local_id,
//       preferred_bank: "Wema",
//       alias: "paybeforeservice",
//     };

//     //Verify identity
//     if (user.kyc !== "1") {
//       const responseVerifyidentity = await makecall(
//         verifyIdentityApiUrl,
//         VerifyIdentityRequestData,
//         headersLocal,
//         "put",
//         next
//       );
//       if (!responseVerifyidentity.success) {
//         return next(new ErrorResponse(responseVerifyidentity.message, 400));
//       }
//       identityData = responseVerifyidentity.data;

//       user = await User.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             kyc: identityData.kyc_tier,
//           },
//         },
//         { new: true }
//       );

//       console.log(identityData, "twooooooooooooooo");
//     }

//     //Create a virtual account
//     if (!user.account?.issue_id) {
//       const responseLocalVirtualAccount = await makecall(
//         createVirtualAccountApiUrl,
//         VirtualAccountRequestData,
//         headersLocal,
//         "post",
//         next
//       );
//       if (!responseLocalVirtualAccount.success) {
//         return next(
//           new ErrorResponse(responseLocalVirtualAccount.message, 400)
//         );
//       }
//       virtualAccountData = responseLocalVirtualAccount.data;

//       user = await User.findOneAndUpdate(
//         { _id: req.user._id },
//         {
//           $set: {
//             account: {
//               issue_id: virtualAccountData.id,
//               account_Name: virtualAccountData.customer.name,
//               account_Number: virtualAccountData.account_number,
//               bank: virtualAccountData.bank_name,
//               digits_after_decimal_separator: 2,
//               isActive: true,
//             },
//           },
//         },
//         { new: true }
//       );
//     }

//     res.status(200).json({ status: true, data: user });
//   } catch (error) {
//     // Call handleErrors function
//     next(error);
//   }
// };

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
          beneficiary_name: account_name,
          beneficiary_account: account_number,
          beneficiary_bank_name: bank_name,
          beneficiary_bank_code: bank_code,
        },
        status: "pending",
        description: description,
      },
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
