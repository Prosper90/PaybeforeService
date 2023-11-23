const cookieParser = require("cookie-parser");


// Helper function to send responses, handle errors, and send tokens in cookies
function sendResponseWithToken(res, status, data = null, token = null) {
    if (token) {
         res.cookie("access_token", token, {
          httpOnly: true,
        }).status(status)
    }
  
    res.status(status).json(data);
  }



module.exports = {sendResponseWithToken}