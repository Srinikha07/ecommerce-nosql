const neo4j = require('neo4j-driver');

const URI = 'neo4j://127.0.0.1:7687';
const USER = 'neo4j';
const PASSWORD = 'password';

const driver = neo4j.driver(
    URI,
    neo4j.auth.basic(USER, PASSWORD)
);

module.exports = driver;