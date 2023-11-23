const jwt = require("jsonwebtoken");

const maxAge = 3 * 24 * 60 * 60;

// // Replace these keys with your actual encryption keys (three 8-byte keys)
// const key1 = Buffer.from(process.env.KEY_ONE, "hex");
// const key2 = Buffer.from(process.env.KEY_TWO, "hex");
// const key3 = Buffer.from(process.env.KEY_THREE, "hex");

const createToken = (id) => {
  const jwtToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: maxAge,
  });
  // console.log(jwtToken, "inside create");

  // Encrypt the JWT token using 3DES
  // const cipher = crypto.createCipheriv('des-ede3', Buffer.concat([key1, key2, key3]), '');
  // console.log('checking cypher');
  // let encryptedToken = cipher.update(jwtToken, 'utf8', 'base64');
  // encryptedToken += cipher.final('base64');

  return jwtToken;
};

function generateRandomAlphaNumeric(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result.toUpperCase();
}

module.exports = { createToken, generateRandomAlphaNumeric };
