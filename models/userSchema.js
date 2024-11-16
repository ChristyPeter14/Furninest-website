const mongoose = require("mongoose");
const {Schema} = mongoose;


const userSchema = new Schema({
    name : {
        type:String,
        required : true,
    },
    email: {
        type : String,
        required:true,
        unique: true,
    },
    phone : {
        type : String,
        required: false,
        unique: false,
        sparse:true,
        default:null
    },
    googleId: {
        type : String,
        // unique:true,
        sparse:true,
       
    },
    password : {
        type:String,
        required :false
    },
    
    otp:{
        type:Number,
        default:null
    },
    isBlocked: {
        type : Boolean,
        default:false
    },
    isAdmin : {
        type: Boolean,
        default:false
    },
    cart:[
        {
            productId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'Product'
            },
            quantity:{
                type:Number,
                default:1
            }
        }
    ],
    wallet:{
        type:Number,
        default:0,
    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"Wishlist"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn : {
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:String
    },
    redeemed:{
        type:Boolean
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref:"Category",
        },
        brand: {
            type : String
        },
        searchOn : {
            type: Date,
            default: Date.now
        }
    }]
   
})


const User = mongoose.model("User",userSchema);

module.exports = User;

// const mongoose=require('mongoose')
// const userSchema=mongoose.Schema({
    
//     name:{
//         type:String,
//         required:true
//     },
//     email:{
//         type:String,
//         unique:true,
//         required:true
//     },
//     mobile:{
//         type:Number,
//         required:false
//     },
//     password:{
//         type:String,
//         required:false
//     },
//     is_admin:{
//         type:Boolean,
//         default:false
//     },
//     is_active:{
//         type:Boolean,
//         default:true
//     },
//     otp:{
//         type:Number,
//         default:null
//     },
 
   
//     wallet:{
//         type:Number,
//         default:0
//     },
//     referralCode:{
//         type:String
//     },
//     googleId: {  // Add this field to store the Google ID
//         type: String,
//         unique: true,
//         sparse: true, // Allow unique values but permit null (for users not using Google)
//         default:null
//     }
// })




// module.exports=mongoose.model('User',userSchema) 