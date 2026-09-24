const driver = require('./config/neo4j');

async function testConnection() {
    const session = driver.session();

    try {
        const result = await session.run(
            'RETURN "Neo4j connection successful" AS message'
        );

        console.log(result.records[0].get('message'));
    } catch (error) {
        console.error('Neo4j connection failed:', error.message);
    } finally {
        await session.close();
        await driver.close();
    }
}

testConnection();