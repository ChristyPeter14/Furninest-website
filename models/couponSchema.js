const mongoose = require("mongoose");

const {Schema} = mongoose;

const couponSchema = new mongoose.Schema({
    couponCode:{
        type:String,
        default:null
    },
    discount:{
        type:Number,
        default:null
    },
    minPurchase:{
        type:Number,
        default:null
    },
    expiry:{
        type:Date,
        required:true
    },
    is_active:{
        type:Boolean,
        default:false
    },
    redeemedUsers:[
        {
            userId:{
                type:String
            }
        }
    ]

})

const Coupon = mongoose.model("Coupon",couponSchema);

module.exports = Coupon;