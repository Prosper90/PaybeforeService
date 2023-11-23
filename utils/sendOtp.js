require("dotenv").config();
const { sendSMS } = require("./sms");
const { sendEmail } = require("./email");

async function sendOtp(type, otp, reciepient, next) {
  // send Otp to req.body.number
  let status;
  if (type == "email") {
    //send to email
    console.log("Entereed in in here");
    await sendEmail(otp, reciepient, next);
  } else {
    //Send to sms
    status = await sendSMS(otp, reciepient, next);
  }

  return { status: true, message: "here there" };
}

module.exports = { sendOtp };
