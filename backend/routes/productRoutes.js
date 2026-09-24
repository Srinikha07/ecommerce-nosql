const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// CREATE - Add a new product
router.post("/", async (req, res) => {
    try {
        const product = new Product(req.body);

        const savedProduct = await product.save();

        res.status(201).json({
            message: "Product created successfully",
            product: savedProduct
        });
    } catch (error) {
        res.status(400).json({
            message: "Failed to create product",
            error: error.message
        });
    }
});

// READ - Get all products
router.get("/", async (req, res) => {
    try {
        const products = await Product.find();

        res.status(200).json({
            message: "Products retrieved successfully",
            products: products
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to retrieve products",
            error: error.message
        });
    }
});

// READ - Get a single product by productId
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findOne({
            productId: req.params.id
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Product retrieved successfully",
            product: product
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to retrieve product",
            error: error.message
        });
    }
});

// UPDATE - Update a product by productId
router.put("/:id", async (req, res) => {
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { productId: req.params.id },
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Product updated successfully",
            product: updatedProduct
        });
    } catch (error) {
        res.status(400).json({
            message: "Failed to update product",
            error: error.message
        });
    }
});

// DELETE - Delete a product by productId
router.delete("/:id", async (req, res) => {
    try {
        const deletedProduct = await Product.findOneAndDelete({
            productId: req.params.id
        });

        if (!deletedProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.status(200).json({
            message: "Product deleted successfully",
            product: deletedProduct
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete product",
            error: error.message
        });
    }
});

module.exports = router;