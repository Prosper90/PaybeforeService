require('dotenv').config();
const bcrypt = require('bcrypt');
const {sendResponseWithToken} = require("../utils/handleResponse");
const { randomInt } = require('crypto');
const { header } = require('express/lib/request');
const {makecall} = require('../utils/makeRequest');
const crypto = require('crypto');
const ErrorResponse = require('../utils/errorResponse.js');
const {Notifications} = require('../models/Notifications');

/**
 * this is to update the user password
 * 
 */
exports.GetAllNotifications = async (req, res, next) => {
  try {
    const notifications = await Notifications.find();
    if(notifications) res.status(200).json({status: true, data: notifications})
  } catch (error) {
    next(error);
  }
}


/**
 * Get User Transactions
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
exports.GetTxId = async (req, res, next) => {
  try {
    const notifications = await Notifications.findById({_id: req.params.id});
    if(notifications) res.status(200).json({status: true, data: notifications})
  } catch (error) {
    next(error);
  }
}
