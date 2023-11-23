const twilio = require("twilio");
const client = new twilio(process.env.accountSid, process.env.authToken);

const sendSMS = async (otp, reciepient, next) => {
  try {
    const messaging = await client.messages.create({
      body: `${otp}`,
      from: "+1 956 255 6649", // From a valid Twilio number
      to: `+234${reciepient}`, // Text this number
    });
    if (messaging && messaging.sid) {
      // Twilio successfully sent the message
      return { status: true, message: "Message sent successfully" };
    } else {
      // Twilio failed to send the message
      return { status: false, message: "Failed to send message" };
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { sendSMS };
