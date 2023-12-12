require("dotenv").config();
const mongoose = require("mongoose");

const bankSchema = mongoose.Schema({
  beneficiary_name: { type: String },
  beneficiary_account: { type: String },
  beneficiary_bank_name: { type: String },
  beneficiary_bank_code: { type: String },
});

const PaymentSchema = mongoose.Schema({
  linkID: { type: String },
  created: { type: Date, default: Date.now() },
  expired: { type: Date },
  amount: { type: Number },
  isPaid: { type: Boolean, default: false },
  isRedeemed: { type: Boolean, default: false },
  status: { type: String }, // there is redeemed, pending and cancelled
  sender: bankSchema,
  reciever: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const WithdrawalSchema = mongoose.Schema({
  amount: { type: Number },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reciever: bankSchema,
  description: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String },
});

const transactionSchema = mongoose.Schema(
  {
    type: { type: String },
    payment: PaymentSchema,
    withdrawal: WithdrawalSchema,
    track_id: { type: String },
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
