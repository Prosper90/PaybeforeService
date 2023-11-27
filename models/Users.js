require("dotenv").config();
const mongoose = require("mongoose");
const { isEmail } = require("validator");
const bcrypt = require("bcrypt");
const ErrorResponse = require("../utils/errorResponse");

const accountSchema = mongoose.Schema({
  issue_id: { type: String },
  account_Name: { type: String },
  account_Number: { type: String },
  bank: { type: String },
  limit: { type: String, default: null },
  digits_after_decimal_separator: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

const BankSchema = mongoose.Schema({
  bank_Name: { type: String },
  acc_Number: { type: String },
});

const balanceSchema = mongoose.Schema({
  main_wallet: { type: Number },
  pending_wallet: { type: Number },
  refferal_wallet: { type: Number },
});

const linkGenerated = mongoose.Schema({
  linkID: { type: String },
  created: { type: Date, default: Date.now() },
  expired: { type: Date },
  amount: { type: Number },
  redeemCode: { type: String },
  isPaid: { type: Boolean, default: false },
  status: { type: String }, // there is redeemed, pending and cancelled
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
    password: {
      type: String,
      minlength: [8, "Minimum password length is 4 characters"],
      select: false,
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    gender: { type: String },
    account: accountSchema,
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    date_of_birth: { type: Date },
    bank_info: BankSchema,
    userReferralID: { type: Number },
    referringUserIDs: [{ type: mongoose.Schema.Types.ObjectId }],
    recent_transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transactions",
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
userSchema.statics.login = async function (email, password, next) {
  const user = await this.findOne({ email: email }).select("+password");

  if (!user) return next(new ErrorResponse("incorrect email", 401));
  const auth = await bcrypt.compare(password, user.password);
  if (!auth) return next(new ErrorResponse("incorrect password", 401));

  return user;
};

//Method to handle recent transactions
userSchema.pre("findOneAndUpdate", async function () {
  const data = this.getQuery(); // Access the query to get the user data
  const dataRecenttx = this.getUpdate();
  const user = await this.model.findOne(data);
  if (dataRecenttx.$push && dataRecenttx.$push.recent_transactions) {
    if (user && user.recent_transactions) {
      const maxLength = 5;
      if (user.recent_transactions.length === maxLength) {
        await this.model.updateOne(
          { _id: user._id },
          { $pop: { recent_transactions: -1 } }
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
