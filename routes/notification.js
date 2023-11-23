const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/authMiddleware');


 const notificationController = require('../controllers/notification.controller');

//Users route

//for personal profiles
router.get('/Nx', requireAuth, notificationController.GetAllNotifications);

router.put('/Nx/:id', requireAuth, notificationController.GetTxId);


module.exports = router;
    