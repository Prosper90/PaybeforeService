const authController = require("../controllers/auth.controller");
const { requireAuthAdmin } = require("../middlewares/authMiddleware");
const express = require("express");

const router = express.Router();

//router.post('/otp', authController.SendOtp);
router.get("/get_users", authController.RegisterWithOtp);

router.put("/update_user", authController.CreateAccount);

router.put("/ban_user", authController.loginUser);

router.put("/unban_user", authController.loginUser);

router.put("/refund", authController.loginUser);

module.exports = router;
