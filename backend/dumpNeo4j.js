require('dotenv').config();
const fs = require('fs');
const driver = require('./config/neo4j');

async function dumpNeo4j() {
  const session = driver.session();
  try {
    const nodesResult = await session.run(
      `MATCH (n) RETURN labels(n) AS labels, properties(n) AS props`
    );
    const nodes = nodesResult.records.map(r => ({
      labels: r.get('labels'),
      properties: r.get('props'),
    }));

    const relsResult = await session.run(
      `MATCH (a)-[r]->(b)
       RETURN labels(a) AS fromLabels, properties(a) AS fromProps,
              type(r) AS relType, properties(r) AS relProps,
              labels(b) AS toLabels, properties(b) AS toProps`
    );
    const relationships = relsResult.records.map(r => ({
      from: { labels: r.get('fromLabels'), properties: r.get('fromProps') },
      type: r.get('relType'),
      properties: r.get('relProps'),
      to: { labels: r.get('toLabels'), properties: r.get('toProps') },
    }));

    fs.writeFileSync('./dumps/neo4j_nodes.json', JSON.stringify(nodes, null, 2));
    fs.writeFileSync('./dumps/neo4j_relationships.json', JSON.stringify(relationships, null, 2));

    console.log(`Dumped ${nodes.length} nodes and ${relationships.length} relationships.`);
  } finally {
    await session.close();
    process.exit(0);
  }
}

dumpNeo4j().catch((err) => {
  console.error('Dump failed:', err);
  process.exit(1);
});