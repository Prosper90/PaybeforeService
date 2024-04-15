const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware");

const userController = require("../controllers/users.controller");

//for personal profiles
router.get(
  "/forgetPasswordRequest/:email",
  userController.ForgetPasswordRequest
);

router.put("/forgetPasswordUpdate", userController.ForgetPasswordUpdate);

router.put("/updatePassword", requireAuth, userController.UpdatePassword);

router.put("/UpdatePin", requireAuth, userController.UpdatePin);

router.get("/getProfile", requireAuth, userController.GetProfile);

// router.put(
//   "/updateVerifyProfile",
//   requireAuth,
//   userController.updateVerifyProfile
// );

router.put("/updateProfile", requireAuth, userController.updateProfile);

//For withdrawal
router.get(
  "/getAccountName/:account_number/:bank_code",
  requireAuth,
  userController.AccountName
);

router.post("/withdraw", requireAuth, userController.withdraw);

module.exports = router;
