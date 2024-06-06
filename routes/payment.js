const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment.controller");
const { requireAuth } = require("../middlewares/authMiddleware");

//Payment route
router.get(
  "/verifyPayment/:payment_id",
  paymentController.VerifypaymentDetailsfromIDOrLink
);
router.post(
  "/generatePaymentLink",
  requireAuth,
  paymentController.GeneratePaymentLink
);
router.post("/remakePayment", paymentController.RemakePayment);
router.post("/sender_email", paymentController.SenderEmail);
router.post("/expired_payment", paymentController.ExpiredPayment);
router.post("/payToLink", paymentController.MakePaymentToLink);
router.post("/redeemPayment", requireAuth, paymentController.ReedemPayment);
router.post("/cancelPayment", requireAuth, paymentController.CancelPayment);
//check repayment
router.get(
  "/checkRepayment/:PayId",
  requireAuth,
  paymentController.CheckRepayment
);

module.exports = router;
