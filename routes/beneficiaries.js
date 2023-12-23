const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/authMiddleware");

const beneController = require("../controllers/beneficiaries.controller");

router.post("/addbeneficiary", requireAuth, beneController.CreateBene);

router.delete("/delbeneficiary/:id", requireAuth, beneController.deleteBene);

module.exports = router;
