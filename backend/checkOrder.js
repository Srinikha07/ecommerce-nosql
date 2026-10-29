require("dotenv").config();

const mongoose = require("mongoose");
const Order = require("./models/Order");

async function checkOrder() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const order = await Order.findOne({
            orderId: "ORD-20261021-b4e4"
        }).lean();

        console.log(
            JSON.stringify(order, null, 2) || "Order not found"
        );
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrder();