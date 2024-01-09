const express = require("express");
const router = express.Router();

const disputeController = require("../controllers/dispute.controller");
// const { requireAuth } = require("../middlewares/authMiddleware");

//Dipute route

//find a particular dispute
router.get("/find_dispute/:id", disputeController.FindDispute);

router.post("/create_dispute", disputeController.Createdispute);
// router.post(
//   "/generatePaymentLink",
//   requireAuth,
//   paymentController.GeneratePaymentLink
// );
// router.post("/payToLink", paymentController.MakePaymentToLink);
// router.post("/redeemPayment", requireAuth, paymentController.ReedemPayment);
// router.post("/cancelPayment", requireAuth, paymentController.CancelPayment);

module.exports = router;
