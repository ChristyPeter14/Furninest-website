const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Brand=require("../../models/brandSchema")
const Wishlist=require("../../models/wishlistSchema")
const Order=require("../../models/orderSchema")

const nodeMailer=require("nodemailer")
const env=require("dotenv").config()
const bcrypt=require("bcrypt")
const { json } = require('express')
const session = require('express-session') 
const Address = require("../../models/addressSchema")
const {v4:uuidv4} = require('uuid');
const fs=require('fs')
const { log } = require("debug/src/browser")






const showWishlist=async(req,res)=>{
    try {
        const {email}=req.session.user
        const userData=await User.findOne({email})
        const WishlistData=await Wishlist.findOne({userId:userData._id}).populate('products.productId')
        res.render('wishlist',{user:userData,wishlist:WishlistData})

    } catch (error) {
        console.log(error.message)
        
    }
}

 const addToWishlist=async (req,res)=>{

    try {
        
        const id=req.query.id
    const {email}=req.session.user
    console.log("add to wishlist email: ",email)

    const userData=await User.findOne({email:email})
    const productData=await Product.findById(id)
    const wishlist=await Wishlist.findOne({userId:userData._id})
    console.log("wishlist1 : ",wishlist)

    if(wishlist){
        let productExists=false
        for(let item of wishlist.products){
            if(item.productId.toString()===productData._id.toString()){
               
                productExists=true
                break;

            }
        }
        if(productExists){
            res.redirect('/wishlist')
        }else{
            wishlist.products.push({productId:productData._id})
            const WishlistData=await wishlist.save()

            if(WishlistData){
                console.log("wishlist 2 : ",WishlistData)
                res.redirect('/wishlist')
            }else{
                res.status(500).send("Faild to save wishlist data")
            }
        }

    }else{
        const WishlistData=new Wishlist({
            userId:userData._id,
            products:[{productId:productData._id}]
        })
        const data=await WishlistData.save()
        
        if(data){
            console.log("wishlist 3 : ",data)
            res.redirect('/wishlist')
        }else{
            res.status(500).send('Failed to save wishlist data')
        }
    }
 

    } catch (error) {
        console.error(error.message)
        res.redirect('/pageerror')
        
    }
 }

 const addToCart=async(req,res)=>{
    try {
        const productId=req.query.productId
        const {email}=req.session.user
        console.log("add to cart email: ",email)
        const userData=await User.findOne({email:email})
        const productData=await Product.findById(productId)

        if(!productData || productData.quantity<1){
            res.redirect('/cart?message=Product is out of stock &type=error')
            return
        }
        if(userData&& userData.cart){
            const existingProduct=userData.cart.find(item=>item.productId.toString()===productId)
            const newQuantity=existingProduct?existingProduct.quantity+1:1

            if(newQuantity>productData.quantity){
                res.redirect('/cart?message=insufficient stock to add && type:error')
                return
            }
            if(existingProduct){
                await User.findOneAndUpdate(
                    {email:email,'cart.productId':productId},
                    {$inc:{'cart.$.quantity':1}}
                )
            }else{
                const cartItem={
                    productId:productId,
                    quantity:1
                }
                await User.findOneAndUpdate(
                    {email:email},
                    {$push:{cart:cartItem}}
                )
            }
            await Wishlist.updateOne(
                {userId:userData._id},
                {$pull:{products:{productId:productId}}}
            )
            res.redirect('/cart')
            return

        }
        res.redirect('/cart?message=Something went wrong & type=error')

    } catch (error) {
        console.log(error.message)
        res.redirect('/pageerror')
        
    }
 }

 const deleteFromWishlist=async(req,res)=>{
    try {
        const productId=req.query.productId
        console.log('product di: ',productId)
        const {email}=req.session.user
        console.log("delete from wishlist email:  ",email)
       
        const userData=await User.findOne({email:email})
        console.log("user data : ",userData)
        const WishlistData=await Wishlist.updateOne(
            {userId:userData._id},
            {$pull:{'products':{'productId':productId}}}
        )

        if(WishlistData){
            res.redirect('/wishlist')
        }
    } catch (error) {
        console.log(error.message)
        
    }
 }

module.exports={
showWishlist,
addToWishlist,
addToCart,
deleteFromWishlist
}