const express = require('express');
const router = express.Router();
console.log("Recommendation routes loaded");
const driver = require('../config/neo4j');

// Get product recommendations for a customer
router.get('/:customerId', async (req, res) => {
    const { customerId } = req.params;
    console.log("Recommendation request received for:", customerId);
    const session = driver.session();

    try {
        const result = await session.run(
            `
            MATCH (customer:Customer {customerId: $customerId})
                  -[:PURCHASED]->(product:Product)
                  <-[:PURCHASED]-(otherCustomer:Customer)
                  -[:PURCHASED]->(recommended:Product)

            WHERE otherCustomer <> customer
              AND NOT (customer)-[:PURCHASED]->(recommended)

            RETURN recommended.productId AS productId,
                   recommended.name AS name,
                   recommended.price AS price,
                   COUNT(*) AS recommendationScore

            ORDER BY recommendationScore DESC
            `,
            { customerId }
        );

        const recommendations = result.records.map(record => ({
            productId: record.get('productId'),
            name: record.get('name'),
            price: typeof record.get('price') === 'object' ? record.get('price').toNumber() : record.get('price'),
            recommendationScore: record.get('recommendationScore').toNumber()
        }));

        res.json({
            customerId,
            recommendations
        });

    } catch (error) {
        console.error('Recommendation error:', error);
        res.status(500).json({
            message: 'Failed to fetch recommendations'
        });
    } finally {
        await session.close();
    }
});
module.exports = router;