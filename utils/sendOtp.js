require("dotenv").config();
const { sendSMS } = require("./sms");
const { sendEmail } = require("./email");

async function sendOtp(type, otp, reciepient, next) {
  // send Otp to req.body.number
  let status;
  if (type == "email") {
    //send to email
    status = sendEmail(otp, reciepient, next);
  } else {
    //Send to sms
    status = sendSMS(otp, reciepient, next);
  }

  return status;
}

module.exports = { sendOtp };
