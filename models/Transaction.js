require("dotenv").config();
const mongoose = require("mongoose");

const bankSchema = mongoose.Schema({
  beneficiary_name: { type: String },
  beneficiary_account: { type: String },
  beneficiary_bank_name: { type: String },
  beneficiary_bank_code: { type: String },
});

const transactionSchema = mongoose.Schema(
  {
    type: {
      type: String,
    },
    sender: {
      bank: bankSchema,
      wallet: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    amount: {
      type: Number,
      required: [true, "amount data must be filled"],
      default: "0",
    },
    currency: {
      type: String,
      required: [true, "currency data must be filled"],
      default: "NGN",
    },
    reciever: {
      bank: bankSchema,
      wallet: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    status: { type: String },
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
  Transactions: mongoose.model("Transactions", transactionSchema),
};
