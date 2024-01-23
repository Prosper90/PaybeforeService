$set: {
    "paymentLink.$.isPaid":
      user.paymentLink[0].amount_created >
      parseFloat((data.amount / 100).toFixed(2))
        ? "incomplete"
        : user.paymentLink[0].complete !== 0 &&
          user.paymentLink[0].amount_created >
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
        ? "incomplete"
        : data.status !== "successful"
        ? "failed"
        : user.paymentLink[0].complete !== 0 &&
          user.paymentLink[0].amount_created <=
            parseFloat((data.amount / 100).toFixed(2)) +
              user.paymentLink[0].amount_paid
        ? "complete"
        : "complete",
    "paymentLink.$.redeemCode": redeemCode,
    "paymentLink.$.amount_paid": parseFloat(
      (data.amount / 100).toFixed(2)
    ),
  },