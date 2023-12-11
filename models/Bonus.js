require("dotenv").config();
const mongoose = require("mongoose");

const BonusSchema = mongoose.Schema(
  {
    type: { type: String },
    status: { type: String },
    amount: { type: Number },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

BonusSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

BonusSchema.set("toJSON", {
  virtuals: true,
});

module.exports = {
  Bonus: mongoose.model("Bonus", BonusSchema),
};
