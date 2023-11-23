const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware");

const transactionController = require("../controllers/transactions.controller");

router.get("/getTx", requireAuth, transactionController.GetAllTransactions);

router.get("/getTx/:id", requireAuth, transactionController.GetTxId);

module.exports = router;
