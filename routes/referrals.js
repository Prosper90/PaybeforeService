const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware");

const referralController = require("../controllers/referrals.controllers");

router.get("/getRefs", requireAuth, referralController.GetAllRefs);

router.get("/getRefs/:id", requireAuth, referralController.GetRefId);

module.exports = router;
