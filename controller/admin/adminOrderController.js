const Product=require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const Brand=require("../../models/brandSchema")
const User=require("../../models/userSchema")
const fs=require("fs")
const path=require("path")
const sharp=require("sharp") //resize image
const Order=require('../../models/orderSchema')



const ordersList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const limit = 5;
        const skip = (page - 1) * limit;

        const orderData = await Order.find({})
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId')

        const totalOrders = await Order.countDocuments()
        const totalPages = Math.ceil(totalOrders / limit)

        res.render('ordersList', {
            order: orderData,
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.log(error.message)
        res.redirect('/pageerror')
    }
}

const orderDetailsAdmin=async (req,res)=>{
    try {
        const orderId=req.query.orderId
        console.log("orderId: ",orderId)
        const orderData=await Order.findOne({_id:orderId}).populate('products.productId').populate('userId')
        console.log('order data:',orderData);
        
        res.render('adminorderdetails',{order:orderData})


    } catch (error) {
        console.log(error.message)
        res.redirect('/pageerror')
    }
}

const updateOrderStatus=async (req,res)=>{
    try {
        const {orderId,productId,status:newStatus}=req.body
        console.log("Recieved orderId: ",orderId)
        console.log("Recieved productId: ",productId)
        console.log("Recieved newStatus: ",newStatus)

        const orderData=await Order.findById(orderId)

        if(!orderData){
            console.error('Order not found')
            return res.redirect('/pageerror')
        }
        console.log("Order found: ",orderData)
        const product=orderData.products.find(p=>productId.toString()===productId.toString())

        if(!product){
            console.error('Product not found in order')
            return res.redirect('/pageerror')
        }
        console.log('Product found: ',product)
        product.status=newStatus
        console.log('Updated product status to to: ',newStatus)

        if(newStatus==='Delivered'){
            const allDelivered=orderData.products.every(p=>p.status==='Delivered')
            if(allDelivered){
                orderData.paymentStatus='Success'
                console.log('All products delivered. Updated payment status to Success')
            }
        }

        // find the specific product in the order

        if(newStatus==='Returned'){
            const productInOrder=orderData.products.find(item=>item.productId._id.toString()===productId)
            const userId=orderData.userId._id
            const userData=await User.findById(userId)


            // update product quantity to inventory
            const productData=await Product.findById(productId)
            if(productData && productInOrder.status==='Returned'){
                productData.quantity+=productInOrder.quantity
                await productData.save()
            }
        }
        await orderData.save()
        console.log('order saved successfully')
        res.redirect('/admin/adminorderdetails?orderId='+orderId)

    } catch (error) {
        console.error('error updating order status: ',error.message)
    }
}




module.exports={
    ordersList,
    orderDetailsAdmin ,
    updateOrderStatus
}


