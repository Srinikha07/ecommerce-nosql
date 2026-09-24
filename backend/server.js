require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectMongoDB = require("./config/mongodb");
const recommendationRoutes = require('./routes/recommendationRoutes');
const productRoutes = require("./routes/productRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use('/api/recommendations', recommendationRoutes);
connectMongoDB();

app.get("/", (req, res) => {
    res.json({
        message: "E-Commerce NoSQL Backend is running!"
    });
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});