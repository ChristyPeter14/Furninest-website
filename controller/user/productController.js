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






const addToCart = async (req, res) => {
    try {
        const productId = req.query.productId;
        console.log("add to cart product id: ", productId);
        const { email } = req.session.user;
        console.log("add to cart session user: ", email);
        const quantity = req.body.quantity ? parseInt(req.body.quantity, 10) : 1;

        const userData = await User.findOne({ email });
        console.log("add to cart user: ", userData);
        const productData = await Product.findById(productId);

        if (!productData) {
            res.redirect("/cart?message=product not found");
            return;
        }

        let cartItem = userData.cart.find(item => item.productId.toString() === productId);
        console.log("cart Item: ", cartItem);

        if (cartItem) {
            if (cartItem.quantity + quantity > productData.quantity) {
                res.redirect('/cart?message=Insufficient stock to add');
                return;
            }
            cartItem.quantity += quantity;
        } else {
            if (quantity > productData.quantity) {
                res.redirect('/cart?message=Insufficient stock available');
                return;
            }
            userData.cart.push({ productId, quantity });
        }

        await userData.save();
        res.redirect("/cart");

    } catch (error) {
        console.log(error.message);
        res.redirect("/cart?message=An error occurred while adding to cart");
    }
};

const showCart=async (req,res)=>{
    try {
        const  {email}=req.session.user
        console.log("showcart email: ",email)
        const userData=await User.findOne({email}).populate('cart.productId')
        const categories=await Category.find({isListed:true})
        const brands=await Brand.find({isBlocked:true})

        const message=req.query.message||''

        console.log("show cart user data: ",userData)



        
        res.render("cart",{user:userData,userCart:userData,brands,categories,message})
        
    } catch (error) {
        console.log(error.message)
    }
}

const deleteFromCart=async(req,res)=>{
    try {
        const {email}=req.session.user
        console.log("delete email: ",email);
        
        const cartItemId=req.query.id

        const userData=await User.updateOne(
            {email:email},
            {$pull:{'cart':{'productId':cartItemId}}}
        )
        if(userData){
            res.redirect('/cart')
        }
        
    } catch (error) {
        console.log(error.message)
                
    }

}
const updateQuantity=async(req,res)=>{
    try {
        const {index,newQuantity}=req.params
        const {email}=req.session.user
        console.log("update quantity user email: ",email)
        const userData=await User.findOne({email:email})
        console.log("user data: ",userData)

        if(!userData){
            return res.status(404).send("product not found")
        }

        //update the quantity

        userData.cart[index].quantity=newQuantity
        await userData.save()

        console.log("updated user data: ",userData)


        res.status(200).send("quantity updated successfully")



    } catch (error) {
        console.error(error)
        res.redirect("/page-404")
    }
}




module.exports={
    showCart,
    addToCart,
    deleteFromCart,
    updateQuantity,
    

}







