require("dotenv").config();
const mongoose = require("mongoose");
const { isEmail } = require("validator");
const bcrypt = require("bcrypt");
const ErrorResponse = require("../utils/errorResponse");

const BankSchema = mongoose.Schema({
  bank_Name: { type: String },
  acc_Number: { type: String },
});

const balanceSchema = mongoose.Schema(
  {
    main_wallet: { type: Number },
    pending_wallet: { type: Number },
    refferal_wallet: { type: Number },
  },
  { _id: false } // Specify _id: false to prevent MongoDB from adding _id to the object
);

const withdrawSchema = mongoose.Schema(
  {
    withrawal_requested: { type: Boolean, default: true },
    withdrawal_Amount: { type: Number },
    bank_name: { type: String },
    account_number: { type: String },
    account_name: { type: String },
    track_id: { type: String },
    status: { type: String },
  }
  // { _id: false } // Specify _id: false to prevent MongoDB from adding _id to the object
);

const beneficiariesSchema = mongoose.Schema({
  bank_Name: { type: String },
  bank_Code: { type: String },
  account_Number: { type: String },
  account_Name: { type: String },
  img_url_web: { type: String },
  img_url_phone: { type: String },
});

const linkGenerated = mongoose.Schema({
  linkID: { type: String },

  issue_id: { type: String },
  account_name: { type: String },
  account_number: { type: String },
  bank_name: { type: String },
  created: { type: Date, default: Date.now() },
  payment_recieved: { type: Date },
  expired: { type: Date },
  amount_created: { type: Number },
  amount_paid: { type: Number, default: 0 },
  sender_mail: { type: String },
  redeemCode: { type: String },
  isPaid: { type: String, default: "pending" }, //has values --> complete, incomplete, pending, failed and expired
  incompletePaymentCount: { type: Number, default: 0 },
  status: { type: String }, // there is redeemed, pending, cancelled and expired
});

const userSchema = mongoose.Schema(
  {
    first_name: { type: String },
    last_name: { type: String },
    full_name: { type: String },
    username: {
      type: String,
      unique: true,
      sparse: true,
    },
    otp: { type: Number, default: null },
    otpExpire: { type: Date, default: null },
    local_id: { type: String },
    location: { type: String },
    bvn: { type: String },
    kyc: { type: String },
    phone_number: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentLink: [linkGenerated],
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      validate: [isEmail, "Please enter a valid email"],
    },
    balances: balanceSchema,
    withdrawalIssued: [withdrawSchema],
    password: {
      type: String,
      minlength: [8, "Minimum password length is 8 characters"],
      select: false,
    },
    pin: {
      type: Number,
      minlength: [4, "Minimum pin length is 4 numbers"],
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    gender: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    date_of_birth: { type: Date },
    bank_info: BankSchema,
    beneficiaries: [beneficiariesSchema],
    referer: { type: Number },
    userReferralID: { type: Number },
    referringUserIDs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    recent_transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
  },
  { timestamps: true }
);

// Login method to verify user credentials
// userSchema.statics.matchPassword = async function (password) {
//   // const user = await this.findOne({ 'contact.email': email });
//   // if (user) {
//   //   const auth = await bcrypt.compare(password.toString(), user.pin);
//   //   if (auth) {
//   //     return user;
//   //   }

//   //   next();
//   //}
//   //next();
//   //throw new Error('Incorrect email');

//   return await bcrypt.compare(password, user.password);

// };

// static method to login user
userSchema.statics.login = async function (email, password) {
  const user = await this.findOne({ email: email }).select("+password");

  if (!user) {
    throw new ErrorResponse("incorrect email", 401);
  }
  if (!user.isActive) {
    throw new ErrorResponse("Account Deactivated contact Admin", 401);
  }
  // return next(new ErrorResponse("incorrect email", 401));
  const auth = await bcrypt.compare(password, user.password);
  if (!auth) {
    throw new ErrorResponse("incorrect password", 401);
  }
  // return next(new ErrorResponse("incorrect password", 401));

  return user;
};

//Method to handle recent transactions
// userSchema.pre("findOneAndUpdate", async function () {
//   const data = this.getQuery(); // Access the query to get the user data
//   const dataRecenttx = this.getUpdate();
//   const user = await this.model.findOne(data);
//   if (dataRecenttx.$push && dataRecenttx.$push.recent_transactions) {
//     if (user && user.recent_transactions) {
//       const maxLength = 5;
//       if (user.recent_transactions.length === maxLength) {
//         await this.model.updateOne(
//           { _id: user._id },
//           { $pop: { recent_transactions: -1 } }
//         );
//       }
//     }
//   }
// });

//new one for recent transactions
userSchema.pre("findOneAndUpdate", async function () {
  const data = this.getQuery(); // Access the query to get the user data
  const dataRecenttx = this.getUpdate();
  const user = await this.model.findOne(data);

  if (dataRecenttx.$push && dataRecenttx.$push.recent_transactions) {
    if (user && user.recent_transactions) {
      const maxLength = 5;
      const recentTransactions = dataRecenttx.$push.recent_transactions;

      // Check if the array needs to be trimmed
      if (
        user.recent_transactions.length + recentTransactions.length >
        maxLength
      ) {
        const numToRemove =
          user.recent_transactions.length +
          recentTransactions.length -
          maxLength;
        await this.model.updateOne(
          { _id: user._id },
          {
            $push: {
              recent_transactions: { $each: recentTransactions, $position: 0 },
            },
            $pop: { recent_transactions: numToRemove },
          }
        );
      } else {
        await this.model.updateOne(
          { _id: user._id },
          {
            $push: {
              recent_transactions: { $each: recentTransactions, $position: 0 },
            },
          }
        );
      }
    }
  }
});

userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

userSchema.set("toJSON", {
  virtuals: true,
});

module.exports = {
  User: mongoose.model("User", userSchema),
};
