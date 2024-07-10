require("dotenv").config();
const mongoose = require("mongoose");

const bankSchema = mongoose.Schema({
  account_name: { type: String },
  account_number: { type: String },
});

const PaymentSchema = mongoose.Schema({
  linkID: { type: String },
  created: { type: Date, default: Date.now() },
  expired: { type: Date },
  amount_created: { type: Number },
  amount_paid: { type: Number },
  isPaid: { type: String, default: "pending" }, //holds the values complete, incomplete, pending and failed
  isRedeemed: { type: Boolean, default: false },
  sender: bankSchema,
  reciever: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const WithdrawalSchema = mongoose.Schema({
  amount: { type: Number },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reciever: bankSchema,
  description: { type: String },
  status: { type: String },
});

const transactionSchema = mongoose.Schema(
  {
    type: { type: String },
    payment: PaymentSchema,
    withdrawal: WithdrawalSchema,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    track_id: { type: String },
    status: { type: String }, // there is redeemed, pending and cancelled and for withdrawal success
  },
  { timestamps: true }
);

transactionSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

transactionSchema.set("toJSON", {
  virtuals: true,
});

module.exports = {
  Transaction: mongoose.model("Transaction", transactionSchema),
};
