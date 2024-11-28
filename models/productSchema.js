const mongoose = require("mongoose");
const {Schema} = mongoose;


const productSchema = new Schema({
    productName : {
        type: String,
        required:true,
    },
    description: {
        type :String,
        required:true,
    },
    brand: {
        type:String,
        required:true,
        // type:Schema.Types.ObjectId,
        // ref:"Brand",
        // required:true,
    },
    category: {
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true,
    },
    regularPrice:{
        type:Number,
        required:true,
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer : {
        type:Number,
        default:0,
    },
    rating:{
        type:Number,
        default:null
    },
    quantity:{
        type:Number,
        default:true
    },
    color: {
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
        default:"Available"
    },
    popularity:{
        type:Number,
        default:0
    },
       
    
    productReview: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            comment:{
                type:String
            },
            rating:{
                type:Number
            },
            date:{
                type:Date,
                default: Date.now,
                get: (timestamp) => {
                    return new Date(timestamp).toLocaleDateString('en-IN');
                },
            }
        }
    ]
   
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;