/**
 * Dashboard Performance Measurement Script
 * Measures actual query times for dashboard KPI endpoints without cache
 * Used to decide whether Redis cache is necessary
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'logsystem',
  waitForConnections: true,
  connectionLimit: 1,
  ssl: process.env.DB_SSL === 'true' ? {
    ca: process.env.DB_SSL_CA_PATH ? require('fs').readFileSync(process.env.DB_SSL_CA_PATH) : undefined,
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  } : undefined
};

async function measureQueryTime(pool, query, params = [], label) {
  const start = Date.now();
  try {
    await pool.execute(query, params);
    const duration = Date.now() - start;
    console.log(`✓ ${label}: ${duration}ms`);
    return duration;
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`✗ ${label}: ${duration}ms (ERROR: ${error.message})`);
    return duration;
  }
}

async function measureDashboardPerformance() {
  console.log('=== Dashboard Performance Measurement ===\n');
  console.log('Measuring query times without cache...\n');

  const pool = mysql.createPool(dbConfig);
  
  try {
    await pool.getConnection();
    console.log('Connected to database\n');

    const todayStr = new Date().toISOString().slice(0, 10);
    const timestampCol = 'COALESCE(timestamp, imported_at)';
    const scopeSql = '';
    const scopeParams = [];

    const measurements = [];

    // Measure each dashboard query
    console.log('--- Summary Endpoint Queries ---');
    measurements.push(await measureQueryTime(
      pool,
      'SELECT COUNT(*) as cnt FROM logs WHERE 1=1' + scopeSql,
      scopeParams,
      'Total logs count'
    ));

    measurements.push(await measureQueryTime(
      pool,
      `SELECT COUNT(*) as cnt FROM logs WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ?` + scopeSql,
      [todayStr + ' 00:00:00', ...scopeParams],
      'Today logs count (event timestamp)'
    ));

    measurements.push(await measureQueryTime(
      pool,
      'SELECT COUNT(*) as cnt FROM logs WHERE imported_at >= ?' + scopeSql,
      [todayStr + ' 00:00:00', ...scopeParams],
      'Imported today count'
    ));

    measurements.push(await measureQueryTime(
      pool,
      `SELECT COUNT(*) as cnt FROM logs WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ? AND log_level IN ('ERROR', 'CRITICAL', 'FATAL')` + scopeSql,
      [todayStr + ' 00:00:00', ...scopeParams],
      'Error count today'
    ));

    measurements.push(await measureQueryTime(
      pool,
      "SELECT COUNT(*) as cnt FROM alerts WHERE status = 'new'",
      [],
      'Unread alerts count'
    ));

    measurements.push(await measureQueryTime(
      pool,
      'SELECT COUNT(DISTINCT source) as cnt FROM logs WHERE source IS NOT NULL AND source != \'\'',
      [],
      'Source count'
    ));

    measurements.push(await measureQueryTime(
      pool,
      'SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL' + scopeSql + ' GROUP BY log_level',
      scopeParams,
      'Per-level distribution'
    ));

    console.log('\n--- Trends Endpoint Queries ---');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    measurements.push(await measureQueryTime(
      pool,
      `SELECT DATE_FORMAT(${timestampCol}, '%Y-%m-%d') AS day, log_level, COUNT(*) AS cnt
       FROM logs
       WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ? AND ${timestampCol} <= ?${scopeSql}
       GROUP BY day, log_level
       ORDER BY day ASC`,
      [startDate.toISOString().slice(0, 19).replace('T', ' '), 
       endDate.toISOString().slice(0, 19).replace('T', ' '), 
       ...scopeParams],
      'Trends (7 days)'
    ));

    console.log('\n--- Top Errors Endpoint Queries ---');
    measurements.push(await measureQueryTime(
      pool,
      `SELECT id, fingerprint, title, event_type, error_type, severity_max, occurrence_count,
              first_seen, previous_seen, last_seen, returned_at, return_reason, return_count,
              source_server, service, status, sample_log_id, user_id
       FROM error_groups
       WHERE status IN ('open','returned')${scopeSql}
       ORDER BY (status = 'returned') DESC, occurrence_count DESC
       LIMIT 10`,
      scopeParams,
      'Top errors (10)'
    ));

    console.log('\n--- Recent Logs Endpoint Queries ---');
    measurements.push(await measureQueryTime(
      pool,
      'SELECT * FROM logs WHERE 1=1' + scopeSql + ' ORDER BY id DESC LIMIT 10',
      scopeParams,
      'Recent logs (10)'
    ));

    console.log('\n--- Today Stats Endpoint Queries ---');
    const startSql = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const endSql = endDate.toISOString().slice(0, 19).replace('T', ' ');

    measurements.push(await measureQueryTime(
      pool,
      `SELECT COUNT(*) as total_logs,
              SUM(CASE WHEN log_level IN ('ERROR', 'CRITICAL', 'FATAL') THEN 1 ELSE 0 END) as error_count,
              COUNT(DISTINCT user_id) as active_users
       FROM logs
       WHERE ${timestampCol} >= ? AND ${timestampCol} <= ?${scopeSql}`,
      [startSql, endSql, ...scopeParams],
      'Today stats summary'
    ));

    measurements.push(await measureQueryTime(
      pool,
      `SELECT HOUR(imported_at) as hour, COUNT(*) as cnt
       FROM logs
       WHERE imported_at >= ? AND imported_at <= ?${scopeSql}
       GROUP BY hour
       ORDER BY cnt DESC
       LIMIT 5`,
      [startSql, endSql, ...scopeParams],
      'Activity peaks (5)'
    ));

    // Calculate statistics
    const validMeasurements = measurements.filter(m => m !== null && !isNaN(m));
    const avgTime = validMeasurements.reduce((a, b) => a + b, 0) / validMeasurements.length;
    const maxTime = Math.max(...validMeasurements);
    const minTime = Math.min(...validMeasurements);
    const totalTime = validMeasurements.reduce((a, b) => a + b, 0);

    console.log('\n=== Performance Summary ===');
    console.log(`Total queries measured: ${validMeasurements.length}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per query: ${avgTime.toFixed(2)}ms`);
    console.log(`Min time: ${minTime}ms`);
    console.log(`Max time: ${maxTime}ms`);
    console.log(`Estimated dashboard load time (parallel): ~${maxTime}ms`);
    console.log(`Estimated dashboard load time (sequential): ~${totalTime}ms`);

    console.log('\n=== Recommendation ===');
    if (maxTime < 5000) {
      console.log('✓ All queries complete in under 5 seconds');
      console.log('Recommendation: Remove Redis, use simple in-memory cache with TTL');
      console.log('Reason: No measurable benefit from Redis for current data volume');
    } else {
      console.log('✗ Some queries exceed 5 seconds');
      console.log('Recommendation: Keep Redis cache');
      console.log('Reason: Cache provides measurable performance benefit');
    }

  } catch (error) {
    console.error('Error during measurement:', error.message);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed');
  }
}

measureDashboardPerformance();
