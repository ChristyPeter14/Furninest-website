const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const Brand = require("../../models/brandSchema");

const moment = require("moment");

const path = require("path");
const ejs = require("ejs");

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");

const pageerror = async (req, res) => {
  res.render("admin-error");
};

const loadlogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        console.log(password, passwordMatch);

        req.session.admin = true;
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("admin-login", { message: "Incorrect Password" });
      }
    } else {
      return res.render("admin-login", {
        message: "Admin not found with this email.",
      });
    }
  } catch (error) {
    console.log("login error", error);
    return res.redirect("/pageerror");
  }
};

const loadDashBoard = async (req, res) => {
  try {
    const user = await User.find({});
    const order = await Order.find({})
      .sort({ orderDate: -1 })
      .populate("userId");
    const product = await Product.find({});
    let totalTransactions = 0;

    // Top 10 Selling Products
    const topSellingProducts = await Product.find()
      .sort({ popularity: -1 })
      .limit(10)
      .exec();

    console.log("topselling products: ", topSellingProducts);

    // Categories with quantity sold
    const categories = await Order.aggregate([
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          totalQuantity: { $sum: "$products.quantity" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $project: {
          _id: "$categoryDetails.name",
          totalQuantity: 1,
        },
      },
    ]);

    // Brands with quantity sold
    const brands = await Order.aggregate([
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.brand",
          totalQuantity: { $sum: "$products.quantity" },
        },
      },
    ]);

    res.render("dashboard", {
      user,
      order,
      product,
      topSellingProducts,
      categories,
      brands,
    });
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const getChartData = async (req, res) => {
  try {
    const { filter } = req.query;

    // Define date ranges based on filters
    let startDate, endDate;
    const now = new Date();
    switch (filter) {
      case "daily":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "weekly":
        startDate = new Date();
        startDate.setDate(now.getDate() - 7);
        endDate = now;
        break;
      case "monthly":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return res.status(400).json({ error: "Invalid filter type" });
    }

    // Query data based on filters
    const userCount = await User.countDocuments({});
    const orderCount = await Order.countDocuments({
      orderDate: { $gte: startDate, $lte: endDate },
    });
    const productCount = await Product.countDocuments({});

    // Aggregate revenue and number of orders by category
    const categoryRevenue = await Order.aggregate([
      { $match: { orderDate: { $gte: startDate, $lte: endDate } } }, // Filter orders by date range
      { $unwind: "$products" }, // Unwind the products array
      {
        $lookup: {
          from: "products", // Join with the products collection
          localField: "products.productId", // Match productId in the order's product
          foreignField: "_id", // Match with _id in the products collection
          as: "productDetails", // Add matched product details to each order
        },
      },
      { $unwind: "$productDetails" }, // Unwind the productDetails array
      {
        $group: {
          _id: "$productDetails.category", // Group by product category
          totalRevenue: {
            $sum: { $multiply: ["$products.salePrice", "$products.quantity"] },
          }, // Calculate total revenue by summing salePrice * quantity
          totalOrders: { $sum: 1 }, // Count the number of orders for each category
        },
      },
      {
        $lookup: {
          from: "categories", // Join with the categories collection
          localField: "_id", // Match category ID
          foreignField: "_id", // Match with _id in the categories collection
          as: "categoryDetails", // Add category details to each result
        },
      },
      { $unwind: "$categoryDetails" }, // Unwind the categoryDetails array
      {
        $project: {
          _id: "$categoryDetails.name", // Return the category name
          totalRevenue: 1, // Include total revenue
          totalOrders: 1, // Include total orders
        },
      },
    ]);

    console.log(
      "Category revenue based on number of orders: ",
      categoryRevenue
    );

    // Respond with the data for charts
    res.json({
      barChartData: [userCount, orderCount, productCount],
      doughnutChartData: categoryRevenue, // Return revenue and number of orders by category
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("error destroying the session");
        return res.redirect("/pageerror");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Unexpected error during logout", error);
    res.redirect("/pageerror");
  }
};

const salesReport = async (req, res) => {
  if (req.session.admin) {
    try {
      let dateRange = {};
      const { filterType, startDate, endDate } = req.query;

      // Check for different filter types (daily, weekly, monthly, yearly)
      if (filterType === "daily" && startDate) {
        dateRange = {
          orderDate: {
            $gte: moment(startDate).startOf("day").toDate(),
            $lte: moment(startDate).endOf("day").toDate(),
          },
        };
      } else if (filterType === "weekly" && startDate) {
        dateRange = {
          orderDate: {
            $gte: moment(startDate).startOf("week").toDate(),
            $lte: moment(startDate).endOf("week").toDate(),
          },
        };
      } else if (filterType === "monthly" && startDate) {
        dateRange = {
          orderDate: {
            $gte: moment(startDate).startOf("month").toDate(),
            $lte: moment(startDate).endOf("month").toDate(),
          },
        };
      } else if (filterType === "yearly" && startDate) {
        dateRange = {
          orderDate: {
            $gte: moment(startDate).startOf("year").toDate(),
            $lte: moment(startDate).endOf("year").toDate(),
          },
        };
      } else if (startDate && endDate) {
        dateRange = {
          orderDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        };
      }

      // Log the query parameters for debugging
      console.log(req.query);

      // Aggregation pipeline for MongoDB to calculate the sales data
      const aggregationPipeline = [
        { $match: dateRange },
        { $unwind: "$products" },
        { $match: { "products.status": "Delivered" } },
        {
          $group: {
            _id: "$_id",
            orderId: { $first: "$orderId" },
            userId: { $first: "$userId" },
            orderDate: { $first: "$orderDate" },
            originalTotal: {
              $sum: {
                $multiply: ["$products.regularPrice", "$products.quantity"],
              },
            },
            totalAmount: {
              $sum: {
                $multiply: ["$products.salePrice", "$products.quantity"],
              },
            },
            discountAmount: {
              $sum: {
                $subtract: [
                  {
                    $multiply: ["$products.regularPrice", "$products.quantity"],
                  },
                  { $multiply: ["$products.salePrice", "$products.quantity"] },
                ],
              },
            },
            coupon: { $first: "$coupon" },
            paymentMethod: { $first: "$paymentMethod" },
            orderStatus: { $first: "$products.status" },
            totalDiscountPercentage: {
              $avg: {
                $cond: {
                  if: { $gt: ["$products.regularPrice", 0] },
                  then: {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $subtract: [
                              "$products.regularPrice",
                              "$products.salePrice",
                            ],
                          },
                          "$products.regularPrice",
                        ],
                      },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $sort: { orderDate: -1 } },
      ];

      // Fetching the order data with the aggregation pipeline
      const orderData = await Order.aggregate(aggregationPipeline).exec();

      // Get distinct users for calculating the number of customers
      const userData = await Order.distinct("userId", dateRange);

      // Summary calculations for the report
      const summary = {
        totalTransaction: 0,
        totalOrders: 0,
        totalCustomers: userData.length,
        onlinePayments: 0,
        cashOnDelivery: 0,
        orderCancelled: 0,
        totalDiscounts: 0,
        totalCoupons: 0,
      };

      // Calculate totals and filter payments and order statuses
      orderData.forEach((item) => {
        summary.totalTransaction += item.totalAmount || 0;
        summary.totalDiscounts += item.discountAmount || 0;
        summary.totalCoupons += item.coupon || 0;
        summary.totalOrders++;

        // Payment method classification
        if (item.paymentMethod === "Razorpay") {
          summary.onlinePayments++;
        } else {
          summary.cashOnDelivery++;
        }

        // Cancelled order classification
        if (item.orderStatus === "Cancelled") {
          summary.orderCancelled++;
        }
      });

      // Render the sales report page with the data and summary
      res.render("salesReport", {
        orders: orderData,
        ...summary,
        start: req.query.startDate,
        end: req.query.endDate,
        moment,
      });
    } catch (error) {
      console.error("Error in salesReport:", error.message);
      res.status(500).send("Internal server error");
    }
  }
};

const excelReport = async (req, res) => {
  if (req.session.admin) {
    try {
      const { startDate, endDate } = req.query;

      // Construct query with date range and filter by "Delivered" status
      const query =
        startDate && endDate
          ? {
              orderDate: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
              },
              "products.status": "Delivered", // Ensure products are delivered
            }
          : { "products.status": "Delivered" }; // Default to only "Delivered" orders

      // Fetch order data, filter by date range, and ensure product status is "Delivered"
      const orderData = await Order.find(query)
        .populate("userId")
        .sort({ orderDate: -1 });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      // Set up columns for the Excel sheet
      worksheet.columns = [
        { header: "Order ID", key: "orderId", width: 25 },
        { header: "Customer Name", key: "customerName", width: 30 },
        { header: "Original Price", key: "originalTotal", width: 30 },
        { header: "Sale Price", key: "totalAmount", width: 30 },
        { header: "Discount Amount", key: "discountTotal", width: 30 },
        { header: "Discount %", key: "totalDiscountPercentage", width: 30 },
        { header: "Coupon", key: "coupon", width: 30 },
        { header: "Status", key: "orderStatus", width: 30 },
        { header: "Date", key: "orderDate", width: 30 },
      ];

      // Populate the rows with data
      orderData.forEach((order) => {
        worksheet.addRow({
          orderId: order.orderId ? "ORD#" + order.orderId : "N/A",
          customerName: order.userId ? order.userId.name : "N/A",
          originalTotal: order.originalTotal
            ? order.originalTotal.toFixed(2)
            : "N/A",
          totalAmount: order.totalAmount ? order.totalAmount.toFixed(2) : "N/A",
          discountTotal: order.discountTotal
            ? order.discountTotal.toFixed(2)
            : "N/A",
          totalDiscountPercentage: order.totalDiscountPercentage
            ? order.totalDiscountPercentage + "%"
            : "N/A",
          coupon: order.coupon ? "₹" + order.coupon.toFixed(2) : "N/A",
          orderStatus: order.orderstatus,
          orderDate: moment(order.orderDate).format("DD-MM-YYYY"), // Format the date for readability
        });
      });

      // Set headers for the Excel response
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=Sales_Report.xlsx"
      );

      // Write the Excel file and send it as a response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.log(error.message);
      res.status(500).send("Error generating Excel report.");
    }
  }
};

const pdfReport = async (req, res) => {
  if (req.session.admin) {
    try {
      console.log("I am in pdf download");

      const { startDate, endDate } = req.query;
      console.log("start date from the query: ", startDate);
      console.log("end date from the query: ", endDate);

      // Construct query with ISODate format and filter by "Delivered" status
      const query =
        startDate && endDate
          ? {
              orderDate: {
                $gte: startDate,
                $lte: endDate,
              },
              "products.status": "Delivered", // Ensure products are delivered
            }
          : { "products.status": "Delivered" }; // Default to only "Delivered" orders

      console.log("Final query: ", query);

      // Fetch the filtered order data, including the "Delivered" status filter
      const orderData = await Order.find(query)
        .populate("userId") // Populate user details
        .sort({ orderDate: -1 }); // Sort by most recent order date

      console.log(orderData);
      const orders = orderData.map((order) => ({
        orderId: order.orderId,
        userId: order.userId ? order.userId.name : "N/A",
        originalTotal: order.originalTotal
          ? order.originalTotal.toFixed(2)
          : "N/A",
        totalAmount: order.totalAmount ? order.totalAmount.toFixed(2) : "N/A",
        discountAmount: order.discountTotal
          ? order.discountTotal.toFixed(2)
          : "N/A",
        coupon: order.coupon ? "₹" + order.coupon.toFixed(2) : "N/A",
        orderstatus: order.orderstatus,
        orderDate: moment(order.orderDate).format("DD-MM-YYYY"),
        paymentMethod: order.paymentMethod,
      }));

      console.log("orders: ", orders);

      const totalOrders = orders.length;
      const totalCustomers = (await Order.distinct("userId", query)).length;
      const totalTransaction = orders.reduce(
        (acc, order) => acc + (parseFloat(order.totalAmount) || 0),
        0
      );
      const onlinePayments = orders.filter(
        (order) => order.paymentMethod === "Razorpay"
      ).length;
      const cashOnDelivery = orders.filter(
        (order) => order.paymentMethod !== "Razorpay"
      ).length;
      const orderCancelled = orders.filter(
        (order) => order.orderstatus === "Cancelled"
      ).length;
      const totalDiscounts = orders.reduce(
        (acc, order) => acc + (parseFloat(order.discountAmount) || 0),
        0
      );
      const totalCoupons = orders.reduce(
        (acc, order) => acc + (parseFloat(order.coupon) || 0),
        0
      );

      // Generate the PDF document
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=SalesReport.pdf"
      );
      doc.pipe(res);

      // Title and report summary
      doc.fontSize(20).text("Sales Report", { align: "center" });
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
        doc
          .fontSize(12)
          .fillColor("black")
          .text("Order ID", 50, doc.y, { width: 80, continued: true });
        doc.text("Customer Name", 140, doc.y, { width: 100, continued: true });
        doc.text("Total Amount", 240, doc.y, { width: 100, continued: true });
        doc.text("Discount Amount", 340, doc.y, {
          width: 100,
          continued: true,
        });
        doc.text("Coupon", 440, doc.y, { width: 60, continued: true });
        doc.text("Status", 500, doc.y, { width: 60, continued: true });
        doc.text("Order Date", 560, doc.y);
        doc.moveDown();
      };

      addTableHeader();

      // Adding each order's data to the table
      orders.forEach((order) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          addTableHeader();
        }

        doc
          .fontSize(10)
          .text(order.orderId, 50, doc.y, { width: 80, continued: true });
        doc.text(order.userId, 140, doc.y, {
          width: 100,
          ellipsis: true,
          continued: true,
        });
        doc.text(`₹${order.totalAmount}`, 240, doc.y, {
          width: 100,
          continued: true,
        });
        doc.text(`₹${order.discountAmount}`, 340, doc.y, {
          width: 100,
          continued: true,
        });
        doc.text(order.coupon, 440, doc.y, { width: 60, continued: true });
        doc.text(order.orderstatus, 500, doc.y, { width: 60, continued: true });
        doc.text(order.orderDate, 560, doc.y);
        doc.moveDown();
      });

      // Finalize the PDF document
      doc.end();
    } catch (error) {
      console.log(error.message);
      res.status(500).send("Error generating PDF report.");
    }
  }
};

module.exports = {
  loadlogin,
  login,
  loadDashBoard,
  pageerror,
  logout,
  salesReport,
  excelReport,
  pdfReport,
  getChartData,
};
