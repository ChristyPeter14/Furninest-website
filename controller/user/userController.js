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
const mongoose = require('mongoose');

const signupPage =async (req,res)=>{

    try {
        return res.render("signup")
    } catch (error) {
        console.log("signup page not found");
        res.status(500).send("server error")
        
    }
}

function generateOtp(){
    return Math.floor(100000 +Math.random()*900000).toString()
}

async function sendVerificationEmail(email,otp){
    try {
        const transporter=nodeMailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:"nchristyp98@gmail.com",
                pass:process.env.NODEMAILER_PASSWORD
            }
        })
        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b> Your OTP:${otp}</b>`
            
        })

        return info.accepted.length>0
    } catch (error) {
        console.error("Error seding email",error)
        return false
        
        
    }
}

const signup= async (req,res)=>{
    try {
       const {name,phone,email,password,cpassword}=req.body
       
       if(password!==cpassword){
        return res.render("signup",{message:"password do not  match"})
       }

       const findUser=await User.findOne({email})
       if(findUser){
        return res.render("signup",{message:"User with this email already exists"})
       }

       const otp=generateOtp()
       console.log(otp);
       

       const emailSend=await sendVerificationEmail(email,otp)
       if(!emailSend){
        return res.json("email-error")
       }

       req.session.userOtp=otp
       req.session.userData={name,phone,email,password} 
       

       res.render("verify-otp")
       console.log("OTP sent",otp);

       
    } catch (error) {
        console.error("signup error",error)
        res.redirect("/pageNotFound")
    }
}

const resendOtp=async (req,res)=>{
    try {
        const{email}=req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp=generateOtp()
        req.session.userOtp=otp

        const emailSend=await sendVerificationEmail(email,otp)

        if(emailSend){
            console.log("Resend otp:",otp);
            res.status(200).json({success:true,message:"OTP resend successfully"})
            
        }else {
            res.status(500).json({success:false,message:"Failed to resend OTP.Please try again"})
        }
    } catch (error) {
        console.error("Error resending OTP")
        res.status(500).json({success:false,message:"Internal Server Error.Please try again"})
        
    }
}


const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)

        return passwordHash
    } catch (error) {
        
    }
}
const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;  
        console.log('OTP from client:', otp);
        console.log('OTP from session:', req.session.userOtp);

        // Checking if the OTP matches
        if (otp === req.session.userOtp) {
            const user = req.session.userData; 

            // Hashing the password
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash
            });
            await saveUserData.save();

            // Do not set req.session.user here. Instead, redirect to login page.
            res.json({ success: true, redirectUrl: "/login" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
        }
    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};


const loadLogin=async (req,res)=>{
    try {
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }
        
    } catch (error) {
        res.redirect("/pageNotFound")
        
    }
}

const login=async(req,res)=>{
    try {

        const {email,password}=req.body
        const findUser=await User.findOne({isAdmin:0,email:email})
        if(!findUser){
            return res.render("login",{message:"User not Found"})
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by the admin"})
        }
        const passwordMatch=await bcrypt.compare(password,findUser.password)
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        req.session.user=findUser
        
        console.log(req.session.user);
        
        res.redirect("/")
        
        
    } catch (error) {
        console.error("login error",error)
        res.render("login",{message:"Login failed.Please try again later"})
        
    }
}

const logout=async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session Destruction Error",err.message);
                return res.redirect("/pageNotFound")
                
            }
            console.log("user logged out");
            return res.redirect("/")
            
            
        })
    } catch (error) {
        console.log("Logout Error");
        res.redirect("/pageNotFound")        
        
    }
}



const pageNotFound=async (req,res)=>{
    try {
        res.render("page-404")
        
    } catch (error) {
        res.redirect("/pageNotFound")
        
    }
}


const loadHomepage=async (req,res)=>{

    try {

        const user=req.session.user
        const categories=await Category.find({isListed:true})
        let productData=await Product.find({
            isBlocked:false,
            category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}

             })
             productData.sort((a,b)=> new Date(b.createdOn)-new Date(a.createdOn))
             productData=productData.slice(0,6)
        if(user){
            const userData=await User.findOne({_id:user._id})
            res.render("home",{user:userData,products:productData})
        }else{
            return res.render("home",{products:productData})
        }
        
    } catch (error) {
        console.log("Home page not found");
        res.status(500).send("server error")
        
    }
}
// const loadshopPage=async (req,res)=>{

//     try {
//         let userData=req.session.user
//         let page=1
//         if(req.query.page){
//             page=req.query.page
//         }
//         const limit=9
//         const products=await Product.find({isBlocked:false})
//         .skip((page-1)*limit)
//         .limit(limit*1)
//         .exec()

//         const count=await Product.find({isBlocked:false}).countDocuments()
        
//         return res.render("shop",{
//             products,
//             pages:Math.ceil(count/limit),
//             current:page,
//             previous:page-1,
//             nextpage:Number(page)+1,
//             limit,
//             count,
//             user:userData

//         })
//     } catch (error) {
//         console.log("shop page not found");
//         res.status(500).send("server error")
        
//     }
// }

const loadshopPage = async (req, res) => {
    try {
        let userData = req.session.user
        const cat=await Category.find({isListed:true})
        console.log("categories: ",cat)
     
        let page = req.query.page ? parseInt(req.query.page) : 1
        const limit = 9

        
        let query = { isBlocked: false }

        // Handle search query
        const searchQuery = req.query.search || '';
        if (searchQuery) {
            query.$or = [
                { productName: new RegExp(searchQuery, "i") },
                { description: new RegExp(searchQuery, "i") }
            ];
        }

    
      
              // Convert categoryId to ObjectId if provided
              const categoryId = req.query.categoryId || '';
              if (categoryId) {
                query.categoryId = categoryId

              }
        
        const sort = req.query.sort || '';
        let sortOptions = {};
        switch (sort) {
            case 'atoz':
                sortOptions.productName = 1
                break;
            case 'ztoa':
                sortOptions.productName = -1
                break;
            case 'ascending':
                sortOptions.salePrice = 1 
                break;
            case 'descending':
                sortOptions.salePrice = -1
                break;
            case 'newarrival':
                sortOptions.createdAt = -1
                break;
            case 'rating':
                sortOptions.rating = -1
                break;
            default:
                break;
        }

      
        console.log("Sort options:", sortOptions);

        // Fetch products with sorting applied
        const products = await Product.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .exec();
console.log("products: ",products)
    
        const count = await Product.countDocuments(query);

        // Render the shop page
        return res.render("shop", {
            products,
            pages: Math.ceil(count / limit),
            current: page,
            previous: page - 1,
            nextpage: page + 1,
            limit,
            count,
            user: userData,
            categories:cat,
            search: searchQuery,
            sort: sort,
            categoryId: categoryId

            
        });
        
    } catch (error) {
        console.error("Error loading shop page:", error)
        res.status(500).send("server error");
    }
};

const getProductDetails = async (req, res) => {
    try {
        const productId = req.query.id; 
        let user = req.session.user; 
        let isInWishlist = false;  

        
        const product = await Product.findById(productId)
            .populate('category')  
            .populate('brand');  

            console.log(product)
            

        if (!product) {
            return res.redirect('/')
        }

        
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },  
            isBlocked: false  
        }).limit(4);  

        
        if (user) {
            const userWishlist = await Wishlist.findOne({ userId: user._id });
            
            if (userWishlist && userWishlist.products.includes(productId)) {
                isInWishlist = true;  
            }
        }

        
        if(user){
            console.log("shop user: ",user)

        
        res.render('productDetails', {
            product,  
            user,  
            relatedProducts,  
            isInWishlist  
        });
    }else{
        res.redirect("/login")
    }

    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).send('Server error');
    }
};



//user account 

// const userProfile=async (req,res)=>{
//     try { 
   
//         let email

//         if(req.query.newEmail){
//             email=req.query.newEmail
//             console.log("new email: ",email)
//         }else{
//             email=req.session.user.email
//             console.log("old email: ",email)
//         }


//    console.log("session email: ",email)
    
//    const user=await User.findOne({email:email})
//        console.log("profile email: ",email);
//        console.log("profile user: ",user)
       
//        const address= await Address.findOne({userId:user._id})
//        console.log("user address: ",address)

//         res.render("userProfile",{user:user,address})
//     } catch (error) {
//         console.error('Error fetching user deatails:', error);
//         res.status(500).send('Server error');
//     }
// }
const userProfile = async (req, res) => {
    try {
        let email;

        // Check for newEmail query parameter
        if (req.query.newEmail) {
            email = req.query.newEmail.trim()
            console.log("New email: ", email)
        } else {
            email = req.session.user.email
            console.log("Old email: ", email)
        }

        console.log("Session email: ", email)
        
        // Fetch user from database
        const user = await User.findOne({ email: email })
        if (!user) {
            console.error("User not found")
            return res.status(404).send('User not found')
        }

        console.log("Profile email: ", email)
        console.log("Profile user: ", user)
    

        const address = await Address.findOne({ userId: user._id })
        console.log("User address: ", address);

        // Render the user profile page with user and address data
        res.render("userProfile", { user: user, address: address })
    } catch (error) {
        console.error('Error fetching user details:', error)
        res.status(500).send('Server error');
    }
}


const userAddress=async (req,res)=>{
    try {
        let {email}=req.session.user
        console.log("userAddress email: ",email)

        const user= await User.findOne({email:email})
        console.log("user address user: ",user)

        const address=await Address.find({userId:user._id})
        console.log("user address address: ",address)
        res.render("userAddress",{user,address})
    } catch (error) {
        console.error('Error fetching user address:', error);
        res.status(500).send('Server error');
    }
}

const addressForm=async(req,res)=>{
    try {
        const {email}=req.session.user
        const user= await User.findOne({email:email})
        const checkout=req.query.checkout

        console.log('addressform email: ',email)
        console.log('addressforn user: ',user);
        
        res.render("addAddressForm",{checkout,user})
    } catch (error) {
        
    }
}
const addAddress = async (req, res) => {
    try {
        const checkout=req.body.checkout
        console.log("body: ", req.body)
        const { email } = req.session.user
        console.log('add address email:', email)

        // Find user by email
        const userData = await User.findOne({ email: email })
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" })
        }
        console.log('add address user: ', userData)

        // Destructure address fields from request body
        const { fname, lname, country, houseName, city, state, pincode, phone } = req.body

        // Create a new address document
        const newAddress = new Address({
            userId: userData._id,
            fname: fname,
            lname: lname,
            country: country,
            houseName: houseName,
            city: city,
            state: state,
            pincode: pincode,
            phone: phone,
            email: email
        });

      
        await newAddress.save();

     
        // return res.status(201).json({ success: true, message: "Address added successfully!" })
        if(checkout){
            res.redirect('/checkout')
        }else{
            res.redirect('/userAddress')
        }
        

    } catch (error) {
        console.error("Error adding address:", error)
      
        return res.status(500).json({ success: false, message: "An error occurred while adding the address." })
        
    }
}

const editAddressForm=async (req,res)=>{
    try {
        const {email}=req.session.user
        console.log("edit address email: ",email)
        const addressId=req.query.addressId
        console.log("edit address addressId: ",addressId)
        
        const userData=await User.findOne({email:email})
        console.log("edit user data",userData)

        const address=await Address.findById(addressId)
        console.log("edit address",address)
        res.render("editAddress",{address,user:userData})
        
        
        
    } catch (error) {

        console.log(error.message)
        
    }
}

const updateAddress = async (req, res) => {
    try {
        const addressId = req.query.addressId;
        const { fname, lname, country, houseName, city, state, pincode, phone, email } = req.body

        
        const updatedAddress = {
            fname,
            lname,
            country,
            houseName,
            city,
            state,
            pincode,
            phone,
            email
        };

    
        await Address.findByIdAndUpdate(addressId, updatedAddress)

        // Redirect to the user address page after update
        res.redirect("/userAddress");
    } catch (error) {
        console.error("Error updating address:", error)
        res.status(500).send("Error updating address")
    }
};

const deleteAddress=async(req,res)=>{
    try {
        const addressId= req.query.addressId
        await Address.findByIdAndDelete(addressId)
        res.redirect("/userAddress")
        
    }catch(error){
        console.log(error.message)
    }
}

const showOrder=async(req,res)=>{
    try {
        let {email}=req.session.user
        console.log("show order email: ",email)
        const user=await User.findOne({email:email})
        console.log("show order user");
        const orders=await Order.find({userId:user._id}).populate('products.productId').sort({orderDate:-1})
        console.log("orders: ",orders)
        res.render("showOrder",{orders})
        
    } catch (error) {
        console.log(error.message)
    }
}
const userAccountDetails=async(req,res)=>{
    try {
        const {email}=req.session.user
        console.log("user account deatails email: ",email)
        const user=await User.findOne({email:email})
        console.log("user account user details: ",user)
        const address=await Address.find({userId:user._id})
        res.render('userAccountDetails',{user:user,address})
    } catch (error) {
        
    }
}


const updateUserDetail = async (req, res) => {
    try {
        const { email } = req.session.user
        console.log("Updating user details for email: ", email)

        // Extract data from the request body
        const { name, nemail, mobile } = req.body
        console.log("Received data - Name:", name, "New Email:", nemail, "Mobile:", mobile)
        
        // Update user details in the database
        const userData = await User.findOneAndUpdate(
            { email }, 
            { $set: { name: name, email: nemail, phone: mobile } },
            { new: true } 
        );

        if (userData) {
            // Update the session email after a successful update
            req.session.user.email = nemail; 
            console.log("User details updated successfully:", userData)
            res.redirect(`/userProfile?newEmail=${nemail}`)
        } else {
            console.error("User not found for update with email:", email)
            res.status(404).send('User not found for update')
        }
    } catch (error) {
        console.error('Error updating user details:', error)
        res.status(500).send('Server error')
    }
}

// const updatePassword=async(req,res)=>{
//     try {
        
//         const {email}=req.session.user
//         console.log("update password email: ",email);

//         const{currentPassword,npassword,cpassword}=req.body
        
//         const userData=await User.findOne({email})

//         const passwordMatch=await bcrypt.compare(currentPassword,userData.password)

//         if(passwordMatch){
//             if(npassword==cpassword){
//                 const salt=await bcrypt.genSalt(10)
//                 const hashedPassword=await bcrypt.hash( npassword,salt)
//                 userData.password=hashedPassword
//                 userData.save()

//                 res.status(200).json({message3:"success"})
//             }else{
//                 res.status(200).json({message2:"Passwords do not match"})
//             }
//         }else{
//             res.status(200).json({message1:"Invalid Password"})
//         }
        
//     } catch (error) {
//         console.log(error.message)
//         res.redirect("/page-404")
//     }
// }

const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body
        
      
        const { email } = req.session.user

      
        const user = await User.findOne({ email })

        if (!user) {
            return res.status(404).json({ message: "User not found." })
        }

        // Verify the current password
        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect." })
        }

        // Check if new password matches confirmation
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "New passwords do not match." })
        }

        // Hash the new password and update it in the database
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword;
        await user.save();

        res.json({ message: "Password changed successfully." })
    } catch (error) {
        console.error("Error changing password:", error)
        res.status(500).json({ message: "Server error." })
    }
};




module.exports={
    loadHomepage,
    pageNotFound,
    loadshopPage,
    signupPage,
    signup,
    loadLogin,
    login,
    logout,
    verifyOtp,
    resendOtp,
    getProductDetails,
    userProfile,
    userAddress,
    addressForm,
    addAddress,
    editAddressForm,
    updateAddress,
    deleteAddress,
    showOrder,
    userAccountDetails,
    updateUserDetail,updatePassword
    

}