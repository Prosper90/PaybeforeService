require("dotenv").config();
const jwt = require("jsonwebtoken");
const ErrorResponse = require("../utils/errorResponse");
const { User } = require("../models/Users");

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  console.log("in in in here");
  // Check if the header exists and has the Bearer token format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorResponse("unauthorised access", 401));
  }

  // Extract the token part (remove 'Bearer ' from the header)
  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(
      new ErrorResponse(
        "unauthorised access, token reqiured or user not recognizd",
        401
      )
    );
  }

  // console.log("Entered");
  //   const decrypted = await decryptToken(token);
  //   console.log(decrypted, "decrypted");
  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedToken) => {
    if (err) {
      console.log("err, from inside tag");
      return next(new ErrorResponse("invalid token", 401));
    }

    // find and return user

    let user = await User.findById(decodedToken.id);
    if (!user) return next(new ErrorResponse("Unauthorized access", 401));

    req.user = user;
    next();
  });
};

module.exports = { requireAuth };
