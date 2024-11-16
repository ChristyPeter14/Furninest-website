const User=require("../../models/userSchema")
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")
const Order = require("../../models/orderSchema")
const Coupon = require("../../models/couponSchema")
const moment=require('moment')

const path = require('path');
const ejs=require('ejs')



const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');



const pageerror=async (req,res)=>{
    res.render("admin-error")
}

const loadlogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}

const login=async (req,res)=>{
    try {
        const {email,password}=req.body
        const admin=await User.findOne({email,isAdmin:true})
        if(admin){
            const passwordMatch= await bcrypt.compare(password,admin.password)
            if(passwordMatch){
                console.log(password,passwordMatch);
                
                req.session.admin=true
                return res.redirect("/admin/dashboard")
            }else{
                return res.redirect("/admin/login")
            }
        }else{
            return res.redirect("/admin/login")
        }

    } catch (error) {
    console.log("login error",error);
    return res.redirect("/pageerror")
    
        
    }
}

const loadDashBoard=async (req,res)=>{
    if(req.session.admin){
        try {
            // const user=await User.find({})
            // const order=await Order.find({})

            res.render("dashboard")
        } catch (error) {
            res.redirect("/pageNotFound")
        }
    }
}

const logout= async (req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("error destroying the session");
                return res.redirect("/pageerror")
                
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("Unexpected error during logout",error);
        res.redirect("/pageerror")
        
    }
}

const salesReport=async(req,res)=>{
    if(req.session.admin){
        console.log(req.session.admin)
        try {
            const dateRange=req.query.startDate && req.query.endDate ? {
                orderDate:{
                    $gte:new Date(req.query.startDate),
                    $lte: new Date(req.query.endDate)
                }
            }:{}


            const aggregationPipeline=[
                {$match:dateRange},
                {$unwind:"$products"},
                {$match:{'products.status':"Delivered"}},
                {
                    $group:{
                        _id:"$_id",
                        orderId:{$first:"$orderId"},
                        userId:{$first:"$userId"},
                        orderData:{$first:"$orderDate"},
                        originalTotal:{$sum:{$multiply:["$products.regularPrice","$products.quantity"]}},
                        totalAmount:{$sum:{$multiply:["$products.salePrice","$products.quantity"]}},
                        discountAmount:{
                            $sum:{
                                $subtract:[
                                    {$multiply:["$products.regularPrice","$products.quantity"]},
                                    {$multiply:["$products.salePrice","$products.quantity"]}
                                ]
                            }
                        },
                        coupon:{$first:"$coupon"},
                        paymentMethod:{$first:"$paymentMethod"},
                        orderStatus:{$first:"$products.status"},
                        totalDiscountPercentage:{
                            $avg:{
                                $cond:{
                                    if:{$gt:["$products.regularPrice",0]},
                                    then:{
                                        $multiply:[
                                            {$divide:[{$subtract:["$products.regularPrice","$products.salePrice"]},"$products.regularPrice"]},
                                            100
                                        ]
                                    },
                                    else:0
                                    
                                }
                            }
                        }
                    }
                },
                {$sort:{orderDate:-1}}
            ]
            const orderData=await Order.aggregate(aggregationPipeline).exec()

            const populateOrderData=await Order.populate(orderData,{path:'userId', select:'name'})

            const userData=await Order.distinct('userId',dateRange)


            //calculate summery 

            let totalTransaction=0
            let totalOrders=0
            let totalCustomers=userData.length
            let onlinePayments=0
            let cashOnDelivery=0
            let orderCancelled=0
            let totalDiscounts=0
            let totalCoupons=0

            populateOrderData.forEach((item)=>{
                totalTransaction+=item.totalAmount||0
                totalDiscounts+=item.discountAmount||0
                totalCoupons+=item.coupon||0
                totalOrders++

                if(item.paymentMethod==="Razorpay"){
                    onlinePayments++
                }else{
                    cashOnDelivery++
                }

                if(item.orderstatus==='Cancelled'){
                    orderCancelled++
                }
            })


            res.render('salesReport',{
                orders:populateOrderData,
                totalCustomers,
                totalOrders,
                totalTransaction,
                onlinePayments,
                cashOnDelivery,
                orderCancelled,
                totalDiscounts,
                totalDiscounts,
                totalCoupons,
                start:req.query.startDate,
                end:req.query.endDate,
                moment
            })
        
        } catch (error) {
            console.log(error.message)
            
        }
    }
  

}

const excelReport=async(req,res)=>{
    if(req.session.admin){
        try {
            const query=req.query.startDate && req.query.endDate ?{
                orderDate:{
                    $gte:new Date(req.query.startDate),
                    $lte:new Date(req.query.endDate)

                }
            }:{}

            const orderData=await Order.find(query).populate('userId').sort({orderDate:-1})
            console.log("order data: ",orderData);
            
            const workbook = new ExcelJS.Workbook();

            const worksheet=workbook.addWorksheet('Sales Report')

            worksheet.columns=[
                {header:'Order ID',key:'orderId',width:25},
                {header:'Customer Name',key:'customerName',width:30},
                {header:'Original Price',key:'originalTotal',width:30},
                {header:'Sale Price',key:'totalAmount',width:30},
                {header:'Discount Amount',key:'discountTotal',width:30},
                {header:'Discount %',key:'totalDiscountPercentage',width:30},
                {header:'Coupon',key:'coupon',width:30},
                {header:'Status',key:'orderStatus',width:30},
                {header:'Date',key:'orderDate',width:30},
            ]
            orderData.forEach(order=>{
                worksheet.addRow({
                    orderId:order.orderId ? 'ORD#'+ order.orderId :'N/A',
                    customerName:order.userId.name,
                    originalTotal:order.originalTotal.toFixed(2),
                    totalAmount:order.totalAmount.toFixed(2),
                    discountTotal:order.discountTotal.toFixed(2),
                    totalDiscountPercentage:order.totalDiscountPercentage+'%',
                    coupon:order.coupon?'₹'+order.coupon.toFixed(2):'N/A',
                    orderStatus:order.orderstatus,
                    orderDate:order.orderDate
                })
            })
           
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "Sales_Report.xlsx"
          );

          await workbook.xlsx.write(res)
          res.end()

        } catch (error) {
            console.log(error.message)
            
        }
    }
}





const pdfReport = async (req, res) => {
    if (req.session.admin) {
        try {
            const { startDate, endDate } = req.query;

            // Query setup based on startDate and endDate
            const query = startDate && endDate ? {
                orderDate: {
                    $gte: moment(startDate, 'DD-MM-YYYY').toDate(),
                    $lte: moment(endDate, 'DD-MM-YYYY').toDate()
                }
            } : {};

            // Fetch and process order data
            const orderData = await Order.find(query).populate('userId').sort({ orderDate: -1 });
            const orders = orderData.map(order => ({
                orderId: order.orderId,
                userId: order.userId ? order.userId.name : 'N/A',
                originalTotal: order.originalTotal ? order.originalTotal.toFixed(2) : 'N/A',
                totalAmount: order.totalAmount ? order.totalAmount.toFixed(2) : 'N/A',
                discountAmount: order.discountTotal ? order.discountTotal.toFixed(2) : 'N/A',
                coupon: order.coupon ? '₹' + order.coupon.toFixed(2) : 'N/A',
                orderstatus: order.orderstatus,
                orderDate: moment(order.orderDate).format('DD-MM-YYYY'),
                paymentMethod: order.paymentMethod
            }));

            // Calculate summary information
            const totalOrders = orders.length;
            const totalCustomers = (await Order.distinct('userId', query)).length;
            const totalTransaction = orders.reduce((acc, order) => acc + (parseFloat(order.totalAmount) || 0), 0);
            const onlinePayments = orders.filter(order => order.paymentMethod === 'Razorpay').length;
            const cashOnDelivery = orders.filter(order => order.paymentMethod !== 'Razorpay').length;
            const orderCancelled = orders.filter(order => order.orderstatus === 'Cancelled').length;
            const totalDiscounts = orders.reduce((acc, order) => acc + (parseFloat(order.discountAmount) || 0), 0);
            const totalCoupons = orders.reduce((acc, order) => acc + (parseFloat(order.coupon) || 0), 0);

            // Initialize PDF Document
            const doc = new PDFDocument({ margin: 40 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.pdf');
            doc.pipe(res);

            // Add title and summary information
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Date Range: ${startDate} to ${endDate}`);
            doc.moveDown();
            doc.fontSize(12).text(`Total Orders: ${totalOrders}`);
            doc.text(`Total Customers: ${totalCustomers}`);
            doc.text(`Total Transaction Amount: ₹${totalTransaction.toFixed(2)}`);
            doc.text(`Online Payments: ${onlinePayments}`);
            doc.text(`Cash on Delivery: ${cashOnDelivery}`);
            doc.text(`Cancelled Orders: ${orderCancelled}`);
            doc.text(`Total Discounts: ₹${totalDiscounts.toFixed(2)}`);
            doc.text(`Total Coupons: ₹${totalCoupons.toFixed(2)}`);
            doc.moveDown(2);

            // Function to add table header
            const addTableHeader = () => {
                doc.fontSize(12).fillColor('black').text('Order ID', 50, doc.y, { width: 80, continued: true });
                doc.text('Customer Name', 140, doc.y, { width: 100, continued: true });
                doc.text('Total Amount', 240, doc.y, { width: 100, continued: true });
                doc.text('Discount Amount', 340, doc.y, { width: 100, continued: true });
                doc.text('Coupon', 440, doc.y, { width: 60, continued: true });
                doc.text('Status', 500, doc.y, { width: 60, continued: true });
                doc.text('Order Date', 560, doc.y);
                doc.moveDown();
            };

            addTableHeader();

            // Add each order as a row with pagination
            orders.forEach(order => {
                if (doc.y > doc.page.height - 60) { // Page overflow check
                    doc.addPage();
                    addTableHeader(); // Add table header on new page
                }
                doc.fontSize(10).text(order.orderId, 50, doc.y, { width: 80, continued: true });
                doc.text(order.userId, 140, doc.y, { width: 100, ellipsis: true, continued: true });
                doc.text(`₹${order.totalAmount}`, 240, doc.y, { width: 100, continued: true });
                doc.text(`₹${order.discountAmount}`, 340, doc.y, { width: 100, continued: true });
                doc.text(order.coupon, 440, doc.y, { width: 60, continued: true });
                doc.text(order.orderstatus, 500, doc.y, { width: 60, continued: true });
                doc.text(order.orderDate, 560, doc.y);
                doc.moveDown();
            });

            // Finalize the PDF and end the stream
            doc.end();

        } catch (error) {
            console.error("Error in generating PDF sales report: ", error.message);
            res.status(500).send("Error generating PDF report");
        }
    }
};




module.exports={
    loadlogin,
    login,
    loadDashBoard,
    pageerror,
    logout,
    salesReport,
    excelReport,
    pdfReport

}