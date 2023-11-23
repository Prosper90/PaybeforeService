const nodemailer = require("nodemailer");

const sendEmail = (otp, reciepient, next) => {
  try {
    // Create a transporter object using your SMTP server details
    console.log("called in here here");
    const transporter = nodemailer.createTransport({
      service: "Gmail", // e.g., "Gmail", "Outlook", "Yahoo", or use your SMTP server details
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: reciepient,
      subject: "Hello from PaybeforeService",
      text: `This is a test email sent from Node.js using Nodemailer on Sarturn. ${otp} `,
    };

    // Send email
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent successfully:", info.response);
      }
    });
  } catch (error) {
    next(error);
  }
};

const sendPasswordEmail = (info, reciepient, next) => {
  try {
    // Create a transporter object using your SMTP server details
    const transporter = nodemailer.createTransport({
      service: "Gmail", // e.g., "Gmail", "Outlook", "Yahoo", or use your SMTP server details
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: reciepient,
      subject: "Hello from Saturn",
      text: `This is a test email sent to reset password. ${info} `,
    };

    // Send email
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        return { status: false, message: error };
      } else {
        return { status: true, message: info };
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendEmail, sendPasswordEmail };
