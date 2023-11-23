const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/authMiddleware");
const express = require("express");

const router = express.Router();

//router.post('/otp', authController.SendOtp);
router.post("/sendOtp", authController.RegisterWithOtp);

router.post("/signup", authController.CreateAccount);

router.post("/login", authController.loginUser);

router.put("/resendOtp", authController.ResendOtp);

router.post("/verifyOtpReg", authController.VerifyOtpSignUp);

//router.post('/logout', authController.logOutUser);

module.exports = router;
