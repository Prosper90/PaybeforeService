require("dotenv").config();
const express = require("express");
const user = require("./routes/user");
const admin = require("./routes/admin");
const auth = require("./routes/auth");
const payment = require("./routes/payment");
const transaction = require("./routes/transaction");
const webhook = require("./routes/webhook");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const { ErrorHandler } = require("./middlewares/error");
const Logger = require("./middlewares/log");

const app = express();

app.use(express.urlencoded({ extended: true }));

//parse application/json
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
// Logger middleware
app.use(Logger.logRequest);

const EndpointHead = process.env.Endpoint;
console.log(typeof EndpointHead);

app.use(`${EndpointHead}/auth`, auth);
app.use(`${EndpointHead}/payment`, payment);
app.use(`${EndpointHead}/transaction`, transaction);
app.use(`${EndpointHead}/user`, user);
app.use(`${EndpointHead}/admin`, admin);
app.use(`${EndpointHead}/webhook`, webhook);

// app.get(`${EndpointHead}auth`,  function(req, res){
//     res.send("Hello");
//   });

// Error handler middleware
app.use(ErrorHandler);

//ini my database
mongoose
  .connect("mongodb://localhost:27017/PayBService", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "PayBService",
  })
  .then(() => {
    console.log("Database Connection is ready...");
  })
  .catch((err) => {
    console.log(err);
  });

app.listen(8000, function () {
  console.log(`App is Listening http://localhost:8000${EndpointHead}`);
});
