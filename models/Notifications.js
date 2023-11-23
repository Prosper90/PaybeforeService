require("dotenv").config();
const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema({
  type: { type: String },
  message: { type: String },
});

notificationSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

notificationSchema.set("toJSON", {
  virtuals: true,
});

module.exports = {
  Notifications: mongoose.model("Notification", notificationSchema),
};
