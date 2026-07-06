/**
 * Dashboard Performance Benchmark
 * Measures real KPI query times without cache
 */

import pool from '../config/database.js';
import logger from '../config/logger.js';

const TEST_USER_ID = 1; // Adjust to a real user ID in your database

async function benchmarkDashboard() {
  console.log('=== Dashboard Performance Benchmark ===\n');
  console.log('Testing without cache (direct DB queries)\n');

  const scope = { sql: ' AND user_id = ?', params: [TEST_USER_ID] };
  const timestampCol = 'COALESCE(timestamp, imported_at)';
  const todayStr = new Date().toISOString().slice(0, 10);

  const queries = [
    {
      name: 'Total logs count',
      sql: `SELECT COUNT(*) as cnt FROM logs WHERE 1=1${scope.sql}`,
      params: scope.params
    },
    {
      name: 'Today logs count',
      sql: `SELECT COUNT(*) as cnt FROM logs WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ?${scope.sql}`,
      params: [todayStr + ' 00:00:00', ...scope.params]
    },
    {
      name: 'Imported today count',
      sql: `SELECT COUNT(*) as cnt FROM logs WHERE imported_at >= ?${scope.sql}`,
      params: [todayStr + ' 00:00:00', ...scope.params]
    },
    {
      name: 'Error count (7 days)',
      sql: `SELECT COUNT(*) as cnt FROM logs WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ? AND log_level IN ('ERROR', 'CRITICAL', 'FATAL')${scope.sql}`,
      params: [todayStr + ' 00:00:00', ...scope.params]
    },
    {
      name: 'Unread alerts count',
      sql: `SELECT COUNT(*) as cnt FROM alerts WHERE status = 'new' AND user_id = ?`,
      params: [TEST_USER_ID]
    },
    {
      name: 'Fatal count',
      sql: `SELECT COUNT(*) as cnt FROM logs WHERE log_level = 'FATAL'${scope.sql}`,
      params: scope.params
    },
    {
      name: 'Critical count',
      sql: `SELECT COUNT(*) as cnt FROM logs WHERE log_level = 'CRITICAL'${scope.sql}`,
      params: scope.params
    },
    {
      name: 'Source count',
      sql: `SELECT COUNT(DISTINCT source) as cnt FROM logs WHERE source IS NOT NULL AND source != ''${scope.sql}`,
      params: scope.params
    },
    {
      name: 'Level distribution',
      sql: `SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL${scope.sql} GROUP BY log_level`,
      params: scope.params
    }
  ];

  const results = [];
  let totalTime = 0;

  for (const query of queries) {
    const iterations = 5;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await pool.execute(query.sql, query.params);
        const end = performance.now();
        times.push(end - start);
      } catch (err) {
        console.error(`Error in query "${query.name}":`, err.message);
        times.push(-1);
      }
    }

    const validTimes = times.filter(t => t >= 0);
    if (validTimes.length > 0) {
      const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
      const min = Math.min(...validTimes);
      const max = Math.max(...validTimes);
      results.push({
        name: query.name,
        avg: avg.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2)
      });
      totalTime += avg;
    }
  }

  console.log('Query Results (5 iterations each):\n');
  console.log('Query Name'.padEnd(40) + 'Avg (ms)'.padEnd(12) + 'Min (ms)'.padEnd(12) + 'Max (ms)');
  console.log('-'.repeat(76));

  for (const result of results) {
    console.log(
      result.name.padEnd(40) +
      result.avg.padEnd(12) +
      result.min.padEnd(12) +
      result.max
    );
  }

  console.log('-'.repeat(76));
  console.log(`Total average time for all queries: ${totalTime.toFixed(2)} ms`);
  console.log(`\nConclusion:`);

  if (totalTime < 1000) {
    console.log(`✅ Total time < 1s (${totalTime.toFixed(2)} ms) - Cache not strictly necessary`);
    console.log(`   Recommendation: Use simple in-memory cache (Map with TTL) instead of Redis`);
  } else if (totalTime < 5000) {
    console.log(`⚠️  Total time < 5s but > 1s (${totalTime.toFixed(2)} ms) - Cache beneficial`);
    console.log(`   Recommendation: Keep Redis or implement in-memory cache with longer TTL`);
  } else {
    console.log(`❌ Total time > 5s (${totalTime.toFixed(2)} ms) - Cache required`);
    console.log(`   Recommendation: Keep Redis with optimized queries`);
  }

  await pool.end();
  process.exit(0);
}

benchmarkDashboard().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
