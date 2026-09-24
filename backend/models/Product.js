const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        productId: {
            type: String,
            required: true,
            unique: true
        },

        name: {
            type: String,
            required: true
        },

        category: {
            type: String,
            required: true
        },

        brand: {
            type: String,
            required: true
        },

        price: {
            type: Number,
            required: true
        },

        stock: {
            type: Number,
            required: true
        },

        description: {
            type: String
        },

        rating: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Product", productSchema);