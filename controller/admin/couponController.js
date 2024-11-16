const Product=require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const Brand=require("../../models/brandSchema")
const User=require("../../models/userSchema")
const fs=require("fs")
const path=require("path")
const sharp=require("sharp") //resize image
const Order=require('../../models/orderSchema')
const Coupon=require("../../models/couponSchema")
const exp = require("constants")




const loadCouponPage=async(req,res)=>{
    try {
        let message=''
        let couponCode=''
        let discount=''
        let minPurchase=''
        let expiry=''

        if(req.query.message){
            message='Coupon code already exists'
            couponCode=req.query.couponCode || ''
            discount=req.query.discount||''
            minPurchase=req.query.minPurchase || ''
            expiry=req.query.expiry||''
        }
        const coupon=await Coupon.find({})
        res.render("coupon",{coupon,message,couponCode,discount,minPurchase,expiry})



       
    } catch (error) {
        console.log(error.message)
        
    }
}


const addCoupon=async(req,res)=>{
    try {
        const {couponCode,discount,minPurchase,expiry}=req.body
        const expiryDate=expiry
        const couponData=await Coupon.findOne({couponCode:couponCode})

        if(couponData){
            res.redirect(`/admin/coupon?message=alreadyExists & couponCode=${couponCode}&discount=${discount}&minPurchase=${minPurchase}&expiry=${expiry}`)

        }else{
            const newCoupon= new Coupon({
                couponCode:couponCode,
                discount:discount,
                minPurchase:minPurchase,
                expiry:expiryDate,
                is_active:true

            })
            await newCoupon.save()
            res.redirect('/admin/coupon')
        }

    } catch (error) {
        console.log(error.message)
        
    }
}

const deleteCoupon=async(req,res)=>{
    try {
        const couponId=req.query.id 
        console.log("coupon id: ",couponId)
        await Coupon.deleteOne({_id:couponId})
        res.redirect('/admin/coupon')


    } catch (error) {
        console.log(error.message)
        
    }
}





module.exports={
loadCouponPage,
addCoupon,
deleteCoupon
}

