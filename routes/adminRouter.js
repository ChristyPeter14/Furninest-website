const express=require("express")
const router=express.Router()
const adminController=require("../controller/admin/adminController")
const customerController=require("../controller/admin/customerController")
const categoryController=require("../controller/admin/categoryController")
const brandController=require("../controller/admin/brandController")
const productController=require("../controller/admin/productController")
const adminorderController=require("../controller/admin/adminOrderController")
const couponController=require("../controller/admin/couponController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const multer=require("multer")
const storage=require("../helpers/multer")
const Coupon = require("../models/couponSchema")
const uploads=multer({storage:storage})

router.get("/pageerror",adminController.pageerror)
router.get("/login",adminController.loadlogin)
router.post("/login",adminController.login)

router.get("/dashboard",adminAuth,adminController.loadDashBoard)

router.get("/logout",adminController.logout)

// customer management


router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)


//admin category

router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
router.get("/listCategory",adminAuth,categoryController.getListCateogry)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)


//  Brand Management

router.get("/brands",adminAuth,brandController.getBrandPage)
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand)
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand)
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)


//product management
router.get("/addProducts",adminAuth,productController.getProductAddPage)
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProducts)
router.post("/addProductOffer",adminAuth,productController.addProductOffer)
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer)
router.get("/blockProduct",adminAuth,productController.blockProduct)
router.get("/unblockProduct",adminAuth,productController.unblockProduct)
router.get("/editProduct",adminAuth,productController.getEditProduct)
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct)
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

//order management

router.get('/ordersList',adminAuth,adminorderController.ordersList)
router.get('/adminorderdetails',adminAuth,adminorderController.orderDetailsAdmin)
router.post('/updateOrderStatus',adminAuth,adminorderController.updateOrderStatus)


//coupon management

router.get('/coupon',adminAuth,couponController.loadCouponPage)
router.post('/addCoupon',adminAuth,couponController.addCoupon)
router.get('/deleteCoupon',adminAuth,couponController.deleteCoupon)


//sales report

router.get('/salesReport',adminAuth,adminController.salesReport)
router.get('/downloadExcel',adminAuth,adminController.excelReport)
router.get('/downloadPdfReport',adminAuth,adminController.pdfReport)




module.exports=router