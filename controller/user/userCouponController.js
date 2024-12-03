const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp"); //resize image
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const exp = require("constants");

const applyCoupon = async (req, res) => {
  try {
    const { email } = req.session.user;
    console.log("apply coupon user: ", email);

    req.session.couponCode = req.query.couponCode;
    const couponCode = req.query.couponCode;
    const totalAmount = req.query.totalAmount;
    console.log("coupon code: ", couponCode);

    try {
      const couponData = await Coupon.findOne({ couponCode: couponCode });

      if (!couponData) {
        return res
          .status(200)
          .json({ message: "Invalid Coupon", finalPrice: totalAmount });
      }

      const userData = await User.findOne({ email: email });

      //checking user in redeemed users array

      const isRedeemed = couponData.redeemedUsers.some(
        (user) => user.userId === userData._id.toString()
      );

      if (isRedeemed || totalAmount < couponData.minPurchase) {
        return res
          .status(200)
          .json({ message: "Invalid coupon", finalPrice: totalAmount });
      } else {
        const finalPrice = totalAmount - couponData.discount;
        const discountAmount = couponData.discount;

        res.status(200).json({
          message: "coupon Applied Successfully",
          finalPrice: finalPrice,
          couponAmount: discountAmount,
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Internal Server Error",
      });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const deleteAppliedCoupon = async (req, res) => {
  try {
    req.session.couponCode = null;
    const totalAmount = req.query.totalAmount;
    res.status(200).json({
      message: "Coupon Deleted Successfully",
      finalPrice: totalAmount,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  applyCoupon,
  deleteAppliedCoupon,
};
