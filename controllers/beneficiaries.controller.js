const { User } = require("../models/Users");
const ErrorResponse = require("../utils/errorResponse");

//Create Beneficiaries
exports.CreateBene = async (req, res, next) => {
  try {
    let beneAdd = {};
    //  check if acccount number exits

    if (req.body.account_Number) {
      const checkBene = await User.findOne({
        _id: req.user._id,
        "beneficiaries.account_Number": req.body.account_Number,
      });

      if (checkBene)
        return next(new ErrorResponse("beneficiary already exists", 401));
    }

    beneAdd = { ...req.body };
    //   if (req.body.tag) beneAdd.account_Name = getBene.first_name;
    //console.log(beneAdd, "bene Add");
    const createBene = await User.findOneAndUpdate(
      { _id: req.user._id },
      {
        $push: { beneficiaries: beneAdd }, // Add the transaction to the array
      },
      { new: true }
    );
    if (createBene)
      return res.status(200).json({
        status: 200,
        data: createBene.beneficiaries,
        message: "Beneficiary Added",
      });
  } catch (error) {
    next(error);
  }
};

// users creates account header
// and we call the rapyd API
// before storing to the database
//   exports.getBene = async (req, res, next) => {};

exports.deleteBene = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleteBene = await User.updateOne(
      { _id: req.user._id },
      {
        $pull: { beneficiaries: { _id: id } }, // Add the transaction to the array
      },
      { new: true }
    );
    if (deleteBene)
      return res
        .status(200)
        .json({ status: 200, message: "Beneficiary Deleted" });
  } catch (error) {
    next(error);
  }
};
