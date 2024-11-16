const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Brand=require("../../models/brandSchema")
const Wishlist=require("../../models/wishlistSchema")
const Order=require("../../models/orderSchema")
const Coupon=require("../../models/couponSchema")

const nodeMailer=require("nodemailer")
const env=require("dotenv").config()
const bcrypt=require("bcrypt")
const { json } = require('express')     
const session = require('express-session')    
const Address = require("../../models/addressSchema")
const {v4:uuidv4} = require('uuid');
const fs=require('fs')
const { log } = require("debug/src/browser")
const crypto=require("crypto") 


const Razorpay=require("razorpay")
const { timeStamp } = require("console")

const instance=new Razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
})








const placeOrder = async (req, res) => {
    try {
        const couponCode=req.body.couponSelected   
        const { email } = req.session.user;
        console.log("placeOrder email: ", email);
       
        console.log("coupon code: ",couponCode);
        
        
        const userData = await User.findOne({ email: email }).populate('cart.productId');
        const addressId = req.body.selectAddress; 
        const paymentMethod = req.body.payment_option;
        
        console.log("Payment method: ", paymentMethod);
        
        let totalAmount = parseFloat(req.body.totalAmount); 
        let originalTotal = 0;
        let discountTotal = 0;

        // Check product stock
        for (let i = 0; i < userData.cart.length; i++) {
            if (userData.cart[i].productId.quantity < 1) {
                return res.redirect('/cart?message=stockout');
            } else if (userData.cart[i].productId.quantity < userData.cart[i].quantity) {
                return res.redirect('/cart?message=stocklow');
            }
        }

        // Calculate totals
        userData.cart.forEach(item => {
            const originalPrice = item.productId.regularPrice * item.quantity;
            const salePrice = item.productId.salePrice * item.quantity;
            const discountAmount = originalPrice - salePrice;
            originalTotal += originalPrice;
            discountTotal += discountAmount;
        });
      


        //applying coupon if there is

        let couponData=await Coupon.findOne({couponCode:couponCode})

        console.log("applying coupon: ",couponData);
        
        let coupon=null
        if(couponData!=null){
            totalAmount-=couponData.discount
            totalAmount=parseFloat(totalAmount.toFixed(2))
            const obj={
                userId:userData._id
            }
            await couponData.redeemedUsers.push(obj)
            await couponData.save()
            coupon=couponData.discount
            console.log("coupon after updated: ",coupon)
        }

        const totalDiscountPercentage = (discountTotal / originalTotal) * 100;

        // Calculate delivery charge
        let deliveryCharge = 0;
        if (totalAmount < 1000) {
            deliveryCharge = 100;
        } else if (totalAmount >= 1000 && totalAmount <= 5000) {
            deliveryCharge = 50;
        }

        totalAmount += deliveryCharge;
        totalAmount = parseFloat(totalAmount.toFixed(2));

        const address = await Address.findById(addressId);
        if (!address || userData.cart.length === 0) {
            console.log("Error: Address not found or cart is empty.");
            return res.redirect('/checkout');
        }

        //  product quantity updation in the cart
        const userCart = userData.cart;
        for (let i = 0; i < userCart.length; i++) {
            userCart[i].productId.quantity -= userCart[i].quantity;
            userCart[i].productId.quantity = Math.max(userCart[i].productId.quantity, 0); 

            await Product.findByIdAndUpdate(
                { _id: userCart[i].productId._id },
                {
                    $set: { quantity: userCart[i].productId.quantity },
                    $inc: { popularity: userCart[i].quantity }
                }
            );
        }

        // Prepare order data
        const arr = userCart.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            regularPrice: item.productId.regularPrice,
            salePrice: item.productId.salePrice
        }));

        // Generating  unique orderId
        const generateOrderId = async () => {
            const min = 100000;
            const max = 999999;
            const randomSixDigitNumber = Math.floor(Math.random() * (max - min + 1)) + min;
            const existingOrder = await Order.findOne({ orderId: randomSixDigitNumber });
            return existingOrder ? await generateOrderId() : randomSixDigitNumber;
        };
        
        const orderId = await generateOrderId();

        // Create the order
        const order = new Order({
            userId: userData._id,
            products: arr,
            shippingAddress: {
                fname: address.fname,
                lname: address.lname,
                country: address.country,
                housename: address.houseName,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                phone: address.phone,
                email: address.email
            },
            totalAmount,
            originalTotal,
            discountTotal,
            totalDiscountPercentage,
            paymentMethod,
            orderId,
            coupon:coupon,
            adminTotal: totalAmount,
            shipping: deliveryCharge
        });

        const orderData = await order.save();

        if (orderData) {
            userData.cart = []; 
            await userData.save();

            setTimeout(() => {
                res.redirect('/showOrder');
            }, 2000);
        } else {
            console.log("Error: Order could not be saved.");
            res.redirect('/checkout');
        }

    } catch (error) {
        console.error("Error in placeOrder: ", error.message);
        res.redirect('/checkout');
    }
};

const orderDetails=async (req,res)=>{
    try {
        const {email}=req.session.user
        console.log("order details email: ",email)
        const orderId=req.query.id
        const userData=await User.findOne({email:email}).populate('cart.productId')
        const orderData=await Order.findById({_id:orderId}).populate('products.productId').populate('userId')
        res.render('orderDetails',{orders:orderData,user:userData})
    } catch (error) {
        console.log(error.message)
        console.log('some error loading the page');
        

    }
}

const cancelProduct = async (req, res) => {
    try {
        const { email } = req.session.user;
        const orderId = req.query.orderId;
        const productId = req.query.productId;

        const userData = await User.findOne({ email: email });
        if (!userData) return res.status(404).send('User not found');

        const orderData = await Order.findById(orderId).populate('products.productId').populate('userId');
        if (!orderData) return res.status(404).send('Order not found');

        
        if (orderData.userId._id.toString() !== userData._id.toString()) return res.status(403).send('Unauthorized');

        // Find and cancel the product in the order
        const productInOrder = orderData.products.find(item => item.productId._id.toString() === productId);
        if (!productInOrder) return res.status(404).send('Product not found in order');
        
        // Totals After Cancellation
        const productTotal = parseFloat(productInOrder.salePrice) * productInOrder.quantity;
        productInOrder.status = "Cancelled";

        // Update quantities in Product inventory if needed
        const productData = await Product.findById(productId);
        if (productData) {
            productData.quantity += productInOrder.quantity;
            await productData.save();
        }

        if(orderData.paymentStatus==="Success"){
            userData.wallet+=parseFloat(productInOrder.salePrice)*productInOrder.quantity
            await userData.save()
        }

        // Adjust Order Totals
        orderData.totalAmount -= productTotal;
        orderData.adminTotal -= productTotal;
        orderData.discountTotal = orderData.originalTotal - orderData.totalAmount;
        orderData.totalDiscountPercentage = (orderData.discountTotal / orderData.originalTotal) * 100;

        productInOrder.status==="Cancelled"
        await orderData.save();

        res.redirect('/orderDetails?id=' + orderId);
    } catch (error) {
        console.error("Error cancelling order:", error.message);
        res.status(500).send('Server Error');
    }
};

const returnOrder=async(req,res)=>{
    try {
        const {email}=req.session.user 
        console.log("return order email: ",email)

        const orderId=req.query.id
        console.log("orderId: ",orderId);
        const userData=await User.findOne({email:email}).populate('cart.productId')
        const orderData=await Order.findById({_id:orderId}).populate('products.productId').populate('userId')

        orderData.orderstatus='Return requested'
        await orderData.save()

        async function processOrder(orderData){
            for(const item of orderData.products){
                const productId=item.productId._id

                const quantityToAdd=item.quantity
                const productData=await Product.findById(productId)
                productData.quantity+=quantityToAdd
                await productData.save()
            }
        }

        // calling the processorder functions

        processOrder(orderData)

        // wallet updating 

        if(orderData.paymentStatus==='Success'){
            userData.wallet+=parseFloat(orderData.totalAmount)
            await userData.save()
            console.log("wallet: ",userData.wallet)
            res.redirect('/orderDetails?id='+orderId)
        }else{
            res.redirect('/orderDetails?id='+orderId)
        }
        
    } catch (error) {
       console.log(error.message) 
    }
}

const returnProduct=async(req,res)=>{
    try {
        const {email}=req.session.user
        console.log("return product user email: ",email)
        const orderId=req.body.orderId
        const productId=req.body.productId
        const returnReason=req.body.returnReason

        const userData=await User.findOne({email:email})

        const orderData=await Order.findById(orderId).populate('products.productId').populate('userId')


        //find the product in the order to return 
        const productInOrder=orderData.products.find(item=>item.productId._id.toString()===productId)

        if(!productInOrder){
            return res.status(404).send("product not found in the Order")
        }

        // update product quantity in stock

        const productData=await Product.findById(productId)
        if(productData&& productInOrder.status==='Returned'){
            productData.quantity+=productInOrder.quantity
            await productData.save()
        }

        // change status of the product in the  order to returned
        productInOrder.status='Return requested'
        productInOrder.returnReason=returnReason
        await orderData.save()

        // update users wallet if payment successfull

        if(orderData.paymentStatus==='Success'&&productInOrder.status==='Returned'){
            userData.wallet+=parseFloat(productInOrder.salePrice)*productInOrder.quantity
            orderData.adminTotal-=parseFloat(productInOrder.salePrice)*productInOrder.quantity
            await userData.save()
        }
        res.redirect('/orderDetails?id='+orderId)
    } catch (error) {
        console.log(error.message)

        
    }
}

const showCheckOut = async (req, res) => {
    try {
        const { email } = req.session.user;
        const brands = await Brand.find({ isBlocked: false });
        const userData = await User.findOne({ email: email }).populate('cart.productId');
        const categories = await Category.find({ isListed: true });
        const addresses = await Address.find({ userId: userData._id });
        const coupon=await Coupon.find({is_active:true,"redeemedUsers.userId":{$ne:userData._id}})

        // Check stock
        let flag = 0;
        userData.cart.forEach(item => {
            if (item.productId.quantity < 1) {
                flag = 1;
            } else if (item.productId.quantity < item.quantity) {
                flag = 2;
            }
        });

        if (flag == 1) {
            return res.redirect('/cart?message=stockout');
        } else if (flag == 2) {
            return res.redirect('/cart?message=stocklow');
        }

        if (userData.cart.length > 0) {
            let originalTotal = 0;
            let discountTotal = 0;
            let isCodDisabled=false

            // Calculate totals and discount
            userData.cart.forEach(item => {
                const originalPrice = item.productId.regularPrice * item.quantity;
                const salePrice = item.productId.salePrice * item.quantity;
                const discountAmount = originalPrice - salePrice;

                originalTotal += originalPrice;
                discountTotal += discountAmount;
            });

            const totalDiscountPercentage = (discountTotal / originalTotal) * 100;

            // Calculate delivery charge
            const totalAmountAfterDiscount = originalTotal - discountTotal;
            let deliveryCharge = 0;
            if (totalAmountAfterDiscount < 1000) {
                deliveryCharge = 100;
            } else if (totalAmountAfterDiscount >= 1000 && totalAmountAfterDiscount <= 5000) {
                deliveryCharge = 50;
            }

            if(originalTotal-discountTotal>1000){
                isCodDisabled=true
            }

            const finalAmount = totalAmountAfterDiscount + deliveryCharge;

            // Render checkout page with calculated values
            return res.render('checkout', {
                user: userData,
                categories,
                coupon,
                brands,
                addresses,
                isCodDisabled,
                originalTotal: originalTotal.toFixed(2),
                discountTotal: discountTotal.toFixed(2),
                totalDiscountPercentage: totalDiscountPercentage.toFixed(2),
                deliveryCharge: deliveryCharge.toFixed(0),
                finalAmount: finalAmount.toFixed(2)
            });
        } else {
            return res.redirect('/cart');
        }
    } catch (error) {
        console.log(error.message);
        return res.redirect('page-404');
    }
};


const onlinePayment=async(req,res)=>{
    try {
        let totalAmount=parseFloat(req.query.totalAmount)
        const  couponCode=req.session.couponCode
        const  couponData=await Coupon.findOne({couponCode:couponCode})
        const {email}=req.session.user
        console.log("payment email: ",email)
        const userData=await User.findOne({email:email}).populate('cart.productId')

        let flag=0

        const userCart=userData.cart
        userCart.forEach(item=>{
            if(item.productId.quantity<1){
                flag=1
            }else if(item.productId.quantity<item.quantity){
                flag=2
            }
        })

        let coupon=null
        if(couponData){
            totalAmount-=couponData.discount
            totalAmount=parseFloat(totalAmount.toFixed(2))
            coupon=couponData.discount
        }

        //calculating delivery charge based on the total amount

        let deliveryCharge=0
        if(totalAmount<1000){
            deliveryCharge=100
        }else if(totalAmount>=1000 && totalAmount <=5000){
            deliveryCharge=50
        }

        totalAmount+=deliveryCharge
        totalAmount=parseFloat(totalAmount.toFixed(2))

        var options={
            amount:totalAmount*100, //amount shown in paisa
            currency:"INR",
            receipt:"order_rcptid_11"
        }

        if(flag==0){
            instance.orders.create(options,async function(err,razorOrder){
                if(err){
                    console.log(err.message)
                    res.staus(500).json({error:"Failed to create order"})
                }else{
                    res.status(200).json({
                        message:"Order placed successfully",
                        razorOrder:razorOrder,
                        paymentStatus:"Successfull"
                    })
                }
            })
        }else if(flag==1){
            res.json({message:"Stock out"})
        }else if(flag==2){
            res.json({message:"Stock Low"})
        }

    } catch (error) {
        console.error(error)
        
    }
}

const paymentSuccess=async (req,res)=>{
    try {
        const {email}= req.session.user;
        const userData = await User.findOne({ email: email }).populate('cart.productId');
        
        if (!userData) {
            console.error("User not found");
            return res.redirect('/500');
        }

        const addressId = req.query.addressId; // Ensure addressId is received
        let totalAmount = parseFloat(req.query.totalAmount);
        const couponCode = req.query.couponCode;
        const paymentMethod = 'Razorpay';

        console.log("Received addressId:", addressId);

        // Fetch the address using the addressId
        const address = await Address.findById(addressId);

        console.log("Found address:", address);  // Add this line for debugging

        if (!address) {
            console.error("Address not found");
            return res.redirect('/500');
        }

        let originalTotal = 0;
        let discountTotal = 0;

        userData.cart.forEach(item => {
            const originalPrice = item.productId.regularPrice * item.quantity;
            const salePrice = item.productId.salePrice * item.quantity;
            const discountAmount = originalPrice - salePrice;
            originalTotal += originalPrice;
            discountTotal += discountAmount;
        });

        const totalDiscountPercentage = (discountTotal / originalTotal) * 100;

        const couponData = await Coupon.findOne({ couponCode: couponCode });
        let coupon = null;
        if (couponData) {
            totalAmount -= couponData.discount;
            totalAmount = parseFloat(totalAmount.toFixed(2));
            const obj = { userId: userData._id };
            await couponData.redeemedUsers.push(obj);
            await couponData.save();
            coupon = couponData.discount;
        }

        let deliveryCharge = 0;
        if (totalAmount < 1000) {
            deliveryCharge = 100;
        } else if (totalAmount >= 1000 && totalAmount <= 5000) {
            deliveryCharge = 50;
        }
        totalAmount += deliveryCharge;
        totalAmount = parseFloat(totalAmount.toFixed(2));

        if (userData.cart.length > 0) {
            const userCart = userData.cart;

            for (let i = 0; i < userCart.length; i++) {
                userCart[i].productId.quantity -= userCart[i].quantity;

                if (userCart[i].productId.quantity < 0) {
                    userCart[i].productId.quantity = 0;
                }

                await Product.findByIdAndUpdate(
                    { _id: userCart[i].productId._id },
                    { $set: { quantity: userCart[i].productId.quantity },
                    $inc: { popularity: userCart[i].quantity } }
                );
            }

            let arr = [];
            userCart.forEach((item) => {
                arr.push({
                    productId: item.productId._id,
                    quantity: item.quantity,
                    regularPrice: item.productId.regularPrice,
                    salePrice: item.productId.salePrice
                });
            });

            const randomid = randomId();
            async function randomId() {
                const min = 100000;
                const max = 999999;
                const randomSixDigitNumber = Math.floor(Math.random() * (max - min + 1)) + min;
                const orderData = await Order.findOne({ orderId: randomSixDigitNumber });
                if (orderData) {
                    return await randomId();
                } else {
                    return randomSixDigitNumber;
                }
            }
            const orderId = await randomid;

            const order = new Order({
                userId: userData._id,
                products: arr,
                shippingAddress: {
                    fname: address.fname,
                    lname: address.lname,
                    country: address.country,
                    housename: address.houseName,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode,
                    phone: address.phone,
                    email: address.email
                },
                totalAmount: totalAmount,
                originalTotal: originalTotal,
                discountTotal: discountTotal,
                totalDiscountPercentage: totalDiscountPercentage,
                paymentMethod: paymentMethod,
                orderId: orderId,
                paymentStatus: 'Success',
                coupon: coupon,
                adminTotal: totalAmount,
                shipping: deliveryCharge
            });
            const orderData = await order.save();

            if (orderData) {
                userData.cart = [];
                await userData.save();
                res.redirect('/showOrder');
            }
        } else {
            console.error('Cart is empty');
            res.redirect('/500');
        }
    } catch (error) {
        console.log(error.message);
        res.redirect('/500');
    }
}

const cancelOrder=async(req,res)=>{
    try {
        const {email}=req.session.user
        console.log("cancel order user email: ",email);
        const orderId=req.query.id
        const userData=await User.findOne({email:email}).populate('cart.productId')
        const orderData=await Order.findById({_id:orderId})

        if(orderData.userId._id.toString()==userData._id){
            orderData.orderstatus='Cancelled'
            await orderData.save()

            async function processOrder(orderData){
                for(const item of orderData.products){
                    const productId=item.productId._id
                    console.log("product id: ",productId)
                    const quantityToAdd=item.quantity
                    

                    const productData=await Product.findById(productId)
                    productData.quantity+=quantityToAdd
                    await productData.save()

                    if(productData)
                        console.log("product data: ",productData)
                    else
                        console.log("no product data ");
                        
                    }
                }

                // calling proccess order

                processOrder(orderData)

                // wallet updation

                if(orderData.paymentMethod==="Success"){
                    userData.wallet+=parseFloat(orderData.totalAmount)
                    await userData.save()
                    console.log("Wallet updated with amount:", orderData.totalAmount)
                    res.redirect('/orderDetails?id='+orderId)

                }else{
                    res.redirect('/orderDetails?id='+orderId)
                }
            }else{
                res.render('page-404')
            }
        
        
    } catch (error) {
        console.log(error.message)

    }
}

const createProductReview=async(req,res)=>{
    try {
        const {email}=req.session.user 

        console.log("review user email: ",email)
        const userData=await User.findOne({email:email})
        const userId=userData._id
        const{rating,comment,productId}=req.body


        //data validation

        if(!productId||!rating||!comment){
            return res.status(400).json({error: "User Id,rating and commment are required"})
        }
        //is review exists already
        const productData=await Product.findOne({_id:productId})

        const review={
            userId:userId,
            comment:comment,
            rating:parseInt(rating,10),
            date:Date.now(),
            get:(timestamp)=>new Date(timestamp).toLocaleDateString('en-US')
        }
        console.log('review: ',review)
        productData.productReview.push(review)
        await productData.save()

        //average rating

        let totalRating=0
        for(const item of productData.productReview){
            totalRating+=item.rating
        }
        const avgRating=totalRating/productData.productReview.length
        productData.rating=avgRating
        await productData.save()

        const message=productData.productReview.length>1?'Review updadated successfully':'First review created successfully'
        res.status(200).json({message:message,review:review})

    } catch (error) {
        console.log(error.message)
        res.status(500).json({error:'Internal Server Error'})
        
    }
}

const getWallet=async(req,res)=>{
    try {
        const {email}=req.session.user 
        console.log("wallet user email: ",email)

        const user=await User.findOne({email:email})
        if(!user){
            return res.redirect('/login')
        }

        // fetch orders and product details

        const orders=await Order.find({userId:user._id}).populate('products.productId')

        // extracting transaction based on the payment method

        const transaction=orders.flatMap(order=>{
            const productTransaction=order.products
            .filter(product=>product.status==="Returned" || product.status==='Cancelled')
            .map(product=>({
                orderDate:order.orderDate,
                amount:product.salePrice*product.quantity,
                type:'Credited'
            }))
            if(order.paymentMethod==='Wallet' &&order.paymentMethod==='Success'){
                productTransaction.push({
                    orderDate:order.orderDate,
                    amount:order.totalAmount,
                    type:'Debited'
                })
            }
            return productTransaction
        })

        transaction.forEach(transaction=>{
            transaction.orderDate=new Date(transaction.orderDate)
        })

        transaction.sort((a,b)=>b.orderDate-a.orderDate)
        res.render('wallet',{user,transactions:transaction})
    } catch (error) {
        console.error(error)
    }
}

const walletPayment=async (req,res)=>{
    try {
        console.log("wallet payment ")
        let couponCode=req.body.couponCode
        let{email}=req.session.user
        console.log("wallet payment email: ",email)
        const couponData=await Coupon.findOne({couponCode:couponCode})
        console.log("coupon data: ",couponData)

        const userData=await User.findOne({email:email}).populate('cart.productId')

        const addressId=req.query.addressId
        const paymentMethod='Wallet'
        let totalAmount=parseFloat(req.query.totalAmount)
        

        if(!userData){
            return res.redirect('/500')
        }


        const address= await Address.findById(addressId)

        if(!address){
            return res.redirect('/500')
        }

        let originalTotal=0
        let discountTotal=0

        userData.cart.forEach(product=>{
            const originalPrice=product.productId.regularPrice*product.quantity
            const salePrice=product.productId.salePrice*product.quantity
            const discountAmount=originalPrice-salePrice
            originalTotal+=originalPrice
            discountTotal+=discountAmount
        })

        const totalDiscountPercentage=(discountTotal/originalTotal)*100


        //applying coupon

        let coupon=null
        if(couponData){
            totalAmount-=couponData.discount
            totalAmount=parseFloat(totalAmount.toFixed(2))
            const obj={
                userId:userData._id
            }
            await couponData.redeemedUsers.push(obj)
            await couponData.save()
            coupon=couponData.discount
            
        }

        // calculating delivery charge

        let deliveryCharge=0
        if(totalAmount<1000){
            deliveryCharge=100
        }else if(totalAmount>=1000&&totalAmount<=5000){
            deliveryCharge=50
        }

        totalAmount+=deliveryCharge
        totalAmount=parseFloat(totalAmount.toFixed(2))

        // user wallet updation

        userData.wallet-=totalAmount
        await userData.save()


        if(address&&userData.cart.length>0){
            const userCart=userData.cart

            for(let i=0;i<userCart.length;i++){
                userCart[i].productId.quantity-=userCart[i].quantity

                if(userCart[i].productId.quantity<0){
                    userCart[i].productId.quantity=0
                }
                
                await Product.findByIdAndUpdate(
                    {_id:userCart[i].productId._id},
                    {$set:{quantity:userCart[i].productId.quantity},
                    $inc:{popularity:userCart[i].quantity}}
                )
            }
            
            // products array

            let products=[]
            userCart.forEach((product)=>{
                products.push({
                    productId:product.productId._id,
                    quantity:product.productId.quantity,
                    regularPrice:product.productId.regularPrice,
                    salePrice:product.productId.salePrice
                })

            })

            //generate random order id 

            const randomid=randomId()
            async function randomId(){
                const min=100000
                const max=999999
                const randomSixDigitNumber=Math.floor(Math.random()*(max-min)+1)+min
                const orderData=await Order.findOne({orderId:randomSixDigitNumber})

                if(orderData){
                    return await randomId()
                }else{
                    return randomSixDigitNumber
                }
            }
            const orderId=await randomid


            const order=new Order({
                userId:userData._id,
                products,
                shippingAddress:{
                    fname:address.fname,
                    lname:address.lname,
                    country:address.country,
                    housename:address.houseName,
                    city:address.city,
                    state:address.state,
                    pincode:address.pincode,
                    phone:address.phone,
                    email:address.email
                },
                totalAmount:totalAmount,
                originalTotal:originalTotal,
                discountTotal:discountTotal,
                totalDiscountPercentage:totalDiscountPercentage,
                paymentMethod:paymentMethod,
                orderId:orderId,
                paymentStatus:"Success",
                coupon:coupon,
                adminTotal:totalAmount,
                shipping:deliveryCharge
            })
            const orderData=await order.save()

            if(orderData){
                userData.cart=[]
                await userData.save()
                setTimeout(() => {
                    res.redirect('/showOrder')
                    
                }, 2000);
            }else{
                res.redirect('/checkout')
            }
        }else{
            res.redirect('/checkout')
        }


        

    } catch (error) {
        console.log(error.message)
        res.redirect('/500')
    }
}

const walletChecking=async(req,res)=>{
    try {
        const couponCode=req.session.couponCode
        const couponData=await Coupon.findOne({couponCode:couponCode})
        console.log("coupon code from the session")
        const {email}=req.session.user
        console.log("wallet checking email: ",email);
        const userData=await User.findOne({email:email}).populate('cart.productId')
        const addressId=req.query.addressId
        const address=await Address.findById(addressId)
        let totalAmount=parseFloat(req.query.totalAmount)
        

        if(!userData){
            return res.redirect('/500')
        }

        // fetching address details

        
        if(!address){
            return res.redirect("/500")
        }
        
        // fetching coupon data
        if(couponData){
            const finalPrice=totalAmount-couponData.discount
            totalAmount=finalPrice
        }

        console.log("wallet amount: ",userData.wallet)

        if(totalAmount>userData.wallet){
            res.status(200).json({message:'Insufficient Balance in Wallet'})
        }else{
            console.log('i have enterd in the wallet')
            res.status(200).json({status: "Success", message: ""});

        }

    
        
    } catch (error) {
        console.log(error.message)
        
    }
}


const handlePaymentFailure=async(req,res)=>{
    try {
        console.log(" now i am handling payment failure. this is to check")

        const {email}=req.session.user
        console.log("handle payment failure email : ",email)
        const userData=await User.findOne({email:email}).populate('cart.productId')

        const addressId=req.body.addressId
        const address=await Address.findById(addressId)
        let totalAmount=parseFloat(req.body.totalAmount)
        const couponCode=req.body.couponCode
        const couponData=await Coupon.findOne({couponCode:couponCode})

        const paymentMethod="Razorpay"

        let originalTotal=0
        let discountTotal=0

        userData.forEach(product=>{
            const originalPrice=product.productId.regularPrice*product.productId.quantity
            const salePrice=product.productId.salePrice*product.productId.quantity
            const discountAmount=originalPrice-salePrice
            originalTotal+=originalPrice
            discountTotal+=discountAmount

        })

        const totalDiscountPercentage=(discountTotal/originalTotal)*100

        ///coupon

        let coupon=null
        if(couponData){
            totalAmount-=couponData.discount
            totalAmount=parseFloat(totalAmount.toFixed(2))

            const obj={userId:userData._id}
            await couponData.redeemedUsers.push(obj)
            await couponData.save()
            coupon=couponData.discount
        }

        //delivery charge

        let deliveryCharge=0
        if(totalAmount<1000){
            deliveryCharge=100
        }else if(totalAmount>=1000&&totalAmount<=5000){
            deliveryCharge=50
        }

        totalAmount+=deliveryCharge
        totalAmount=parseFloat(totalAmount.toFixed(2))


        //address and usercart

        if(address&&userData.cart.length>0){
            const userCart=userData.cart

            for(let i=0;i<userCart.length;i++){
                userCart[i].productId.quantity-=userCart[i].quantity

                if(userCart[i].productId.quantity<0){
                    userCart[i].productId.quantity=0
                }
                await Product.findByIdAndUpdate(
                    {_id:userCart[i].productId._id},
                    {$set:{quantity:userCart[i].productId.quantity},
                    $inc:{popularity:userCart[i].quantity} }
                )
            }
            let arr=[]
            userCart.forEach((product)=>{
                arr.push({
                    productId:product.productId._id,
                    quantity:product.quantity,
                    regularPrice:product.productId.regularPrice,
                    salePrice:product.productId.salePrice
                })
            })

            const randomid=randomId()
            async function randomId(){
                const min=100000
                const max=999999
                const randomSixDigitNumber=Math.floor(Math.random()*(max-min)+1)+min
                const orderData=await Order.findOne({orderId:randomSixDigitNumber})

                if(orderData){
                    return await randomId()
                }else{
                    return randomSixDigitNumber
                }
            }
            const orderId=await randomid

            const order = new Order({
                userId: userData._id,
                products: arr,
                shippingAddress: {
                    fname: address.fname,
                    lname: address.lname,
                    country: address.country,
                    housename: address.houseName,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode,
                    phone: address.phone,
                    email: address.email
                },
                totalAmount: totalAmount,
                originalTotal: originalTotal,
                discountTotal: discountTotal,
                totalDiscountPercentage: totalDiscountPercentage,
                paymentMethod: paymentMethod,
                orderId: orderId,
                paymentStatus: 'Pending',
                coupon: coupon,
                adminTotal: totalAmount,
                shipping: deliveryCharge
            })

            const orderData=await order.save()
            

            if(orderData){
                userData.cart=[]
                await userData.save()
                res.redirect('/orderDetails')
            }
        }



    } catch (error) {
        console.log(error.message)
        res.redirect('/500')
        
    }

}



/////Repayment  codes

const initiatePayment=async(req,res)=>{
    try {
        const orderId=req.query.orderId
        const orderData=await Order.findById({_id:orderId}).populate('products.productId').populate('userId')
        const {email}=req.session.user
        const brands=await Brand.find({isBlocked:false})
        const userData=await User.findOne({email:email}).populate('cart.productId')
        const coupon=await Coupon.find({is_active:true,"redeemedUsers.userId":{$ne:userData._id}})
        const categories=await Category.find({isListed:true})


        const addresses=await Address.find({userId:userData._id})

        if(orderData.products.length>0){
            let originalTotal=0
            let discountTotal=0
            let totalDiscountPercentage=0
            let isCodDisabled=false
            let deliveryCharge=0

            orderData.products.forEach(product=>{
                const originalPrice=product.productId.regularPrice*product.quantity
                const salePrice=product.productId.salePrice*product.quantity
                const discountAmount=originalPrice-salePrice
                originalTotal+=originalPrice
                discountTotal+=discountAmount
            })
            totalDiscountPercentage=(discountTotal/originalTotal)*100


            //delivery charge

            

        }
        
    } catch (error) {
        
    }
}








module.exports={
    placeOrder,
    orderDetails,
    cancelProduct,
    returnOrder,
    returnProduct,
    cancelOrder,
    showCheckOut,
    onlinePayment,
    paymentSuccess,
    createProductReview,
    getWallet,
    walletPayment,
    walletChecking

    
}



