
const { performance } = require("perf_hooks");

const BASE_URL = "http://localhost:5000";
const ITERATIONS = 20;

async function measureEndpoint(name, url) {
  const times = [];
  let successes = 0;
  let failures = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    try {
      const response = await fetch(url);
      await response.text();

      const elapsed = performance.now() - start;
      times.push(elapsed);

      if (response.ok) {
        successes++;
      } else {
        failures++;
      }
    } catch (error) {
      failures++;
      console.log(`${name}: Request failed - ${error.message}`);
    }
  }

  if (times.length === 0) {
    console.log(`\n${name}: No successful HTTP responses`);
    return;
  }

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const successRate = (successes / ITERATIONS) * 100;
  const requestsPerSecond =
    times.length / (times.reduce((sum, t) => sum + t, 0) / 1000);

  console.log(`\n${name}`);
  console.log(`Average response time: ${avg.toFixed(2)} ms`);
  console.log(`Minimum response time: ${min.toFixed(2)} ms`);
  console.log(`Maximum response time: ${max.toFixed(2)} ms`);
  console.log(`Successful requests: ${successes}/${ITERATIONS}`);
  console.log(`Failed requests: ${failures}`);
  console.log(`Success rate: ${successRate.toFixed(1)}%`);
  console.log(`Approx. throughput: ${requestsPerSecond.toFixed(2)} requests/sec`);
}

async function main() {
  // Check that the backend is running.
  const health = await fetch(`${BASE_URL}/`);

  if (!health.ok) {
    throw new Error("Backend health check failed.");
  }

  console.log("Backend is running.");
  console.log(`Iterations per endpoint: ${ITERATIONS}`);

  await measureEndpoint(
    "MongoDB - Product Catalog",
    `${BASE_URL}/api/products`
  );

  await measureEndpoint(
    "Redis - Health Check",
    `${BASE_URL}/health/redis`
  );

  await measureEndpoint(
    "Neo4j - Recommendations",
    `${BASE_URL}/api/recommendations/C001`
  );

  await measureEndpoint(
    "MongoDB - Customer Order History",
    `${BASE_URL}/orders/C001`
  );

  // Create one guest session, then benchmark cart retrieval.
  const sessionResponse = await fetch(`${BASE_URL}/session/guest`);

  if (sessionResponse.ok) {
    const session = await sessionResponse.json();

    if (session.sessionId) {
      await measureEndpoint(
        "Redis - Cart Retrieval",
        `${BASE_URL}/cart/${session.sessionId}`
      );
    } else {
      console.log("Cart benchmark skipped: sessionId was not returned.");
    }
  } else {
    console.log("Cart benchmark skipped: could not create guest session.");
  }
}

main().catch((error) => {
  console.error("Benchmark failed:", error.message);
});
