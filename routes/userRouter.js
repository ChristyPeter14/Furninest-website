const express = require("express");
const userController = require("../controller/user/userController");
const productController = require("../controller/user/productController");
const orderController = require("../controller/user/orderController");
const wishlistController = require("../controller/user/wishlistController");
const userCouponController = require("../controller/user/userCouponController");
const passport = require("passport");

const router = express.Router();
const { userAuth, adminAuth } = require("../middlewares/auth");
const { v4: uuidv4 } = require("uuid");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomepage);
router.get("/shop", userController.loadshopPage);

router.get("/productDetails", userAuth, userController.getProductDetails);

router.get("/signup", userController.signupPage);
router.post("/signup", userController.signup);

//referal
router.get("/checkReferral", userController.checkReferal);

router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

router.post("/verify-otp", userController.verifyOtp);
router.post("/resendOtp", userController.resendOtp);

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    res.redirect("/");
  }
);
//forgot password

router.get("/forgot_password", userController.getForgotPassword);
router.post("/forgot-email-valid", userController.forgotEmailValid);
router.post("/verify-forgot-otp", userController.verifyForgotPassOtp);
router.get("/reset-password", userController.getResetPassPage);
router.post("/resend-forgot-otp", userController.resendForgotOtp);
router.post("/resetPassword", userController.postNewPassword);

//my account

router.get("/userProfile", userAuth, userController.userProfile);
router.get("/userAddress", userAuth, userController.userAddress);
router.get("/addAddressForm", userAuth, userController.addressForm);
router.post("/addressForm", userAuth, userController.addAddress);
router.get("/editAddress", userAuth, userController.editAddressForm);
router.post("/editAddressForm", userAuth, userController.updateAddress);
router.get("/deleteAddress", userAuth, userController.deleteAddress);
router.get("/showOrder", userAuth, userController.showOrder);
router.get("/userAccountDetails", userAuth, userController.userAccountDetails);
router.post("/updateAccountDetails", userAuth, userController.updateUserDetail);
router.post("/updatePassword", userAuth, userController.updatePassword);

//cart

router.get("/cart", userAuth, productController.showCart);
router.post("/productDetails", userAuth, productController.addToCart);
router.get("/deleteFromCart", userAuth, productController.deleteFromCart);
router.post(
  "/updateQuantity/:newQuantity/:index",
  userAuth,
  productController.updateQuantity
);

//checkout

router.get("/checkout", userAuth, orderController.showCheckOut);

//order

router.post("/placeOrder", userAuth, orderController.placeOrder);
router.get("/orderDetails", userAuth, orderController.orderDetails);
router.get("/cancelProduct", userAuth, orderController.cancelProduct);
router.get("/returnOrder", userAuth, orderController.returnOrder);
router.get("/cancelOrder", userAuth, orderController.cancelOrder);
router.post("/returnProduct", userAuth, orderController.returnProduct);

router.post(
  "/createProductReview",
  userAuth,
  orderController.createProductReview
);

//Razorpay
router.post("/onlinePayment", userAuth, orderController.onlinePayment);
router.get("/onlinepayment", userAuth, orderController.paymentSuccess);
router.post(
  "/handlePaymentFailure",
  userAuth,
  orderController.handlePaymentFailure
);

//wishlist
router.get("/wishlist", userAuth, wishlistController.showWishlist);
router.get("/addToWishlist", userAuth, wishlistController.addToWishlist);
router.get("/addToCart", userAuth, wishlistController.addToCart);
router.get(
  "/deleteFromWishlist",
  userAuth,
  wishlistController.deleteFromWishlist
);

//coupon
router.get("/applyCoupon", userAuth, userCouponController.applyCoupon);
router.get("/deleteCoupon", userAuth, userCouponController.deleteAppliedCoupon);

//wallet

router.get("/wallet", userAuth, orderController.getWallet);
router.get("/walletPayment", userAuth, orderController.walletPayment);
router.get("/walletChecking", userAuth, orderController.walletChecking);

//repayment

router.get("/payment", userAuth, orderController.initiatePayment);
router.get("/walletRepayment", userAuth, orderController.walletRepayment);
router.post("/onlineRepayment", userAuth, orderController.onlineRepayment);
router.get("/onlineRepayment", userAuth, orderController.repaymentSuccess);
router.post("/placeReOrder", userAuth, orderController.placeReorder);

module.exports = router;
