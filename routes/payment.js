const express = require("express");
const router = express.Router();

const paymentController = require("../controllers/payment.controller");
const { requireAuth } = require("../middlewares/authMiddleware");

//Payment route
router.get(
  "/verifyPayment/:payment_id",
  paymentController.GetpaymentDetailsfromIDOrLink
);
router.post(
  "/generatePaymentLink",
  requireAuth,
  paymentController.GeneratePaymentLink
);
router.post("/payToLink", paymentController.MakePaymentToLink);
router.post("/redeemPayment", requireAuth, paymentController.ReedemPayment);
router.post("/cancelPayment", requireAuth, paymentController.CancelPayment);

module.exports = router;
