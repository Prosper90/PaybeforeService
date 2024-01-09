require("dotenv").config();
const mongoose = require("mongoose");

const DisputeSchema = mongoose.Schema(
  {
    type: { type: String }, //the types here includes *transaction, *info *complaint and inquiry
    status: { type: String },
    payment_status: { type: String }, //contains *pending*, *failed* and *complete*
    dispute_id: { type: String },
    amount: { type: Number },
    email: { type: String },
    sender: { type: String },
    reciever: { type: String },
    reason: { type: String },
    reminder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DisputeSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

DisputeSchema.set("toJSON", {
  virtuals: true,
});

module.exports = {
  Dispute: mongoose.model("Dispute", DisputeSchema),
};
