import pool from '../config/database.js';
import logger from '../config/logger.js';

async function testDashboardEndpoints() {
  console.log('=== Testing Dashboard Endpoints ===\n');
  
  try {
    // Test 1: Summary endpoint
    console.log('1. Testing /api/dashboard/summary');
    const [total] = await pool.execute('SELECT COUNT(*) as cnt FROM logs');
    const [levelRows] = await pool.execute('SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL GROUP BY log_level');
    
    const levels = {};
    for (const row of levelRows) {
      levels[String(row.log_level || '').toUpperCase()] = Number(row.cnt);
    }
    
    console.log('   Total logs:', total[0].cnt);
    console.log('   Level breakdown:', levels);
    console.log('   ✓ Summary data retrieved\n');
    
    // Test 2: Trends endpoint
    console.log('2. Testing /api/dashboard/trends');
    const timestampCol = 'COALESCE(timestamp, imported_at)';
    const [trendRows] = await pool.execute(
      `SELECT DATE_FORMAT(${timestampCol}, '%Y-%m-%d') AS day,
              log_level,
              COUNT(*) AS cnt
       FROM logs
       WHERE ${timestampCol} IS NOT NULL 
         AND ${timestampCol} >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY day, log_level
       ORDER BY day ASC
       LIMIT 20`
    );
    
    console.log('   Trend rows:', trendRows.length);
    if (trendRows.length > 0) {
      console.log('   Sample data:', trendRows.slice(0, 3));
    }
    console.log('   ✓ Trends data retrieved\n');
    
    // Test 3: Per-level endpoint
    console.log('3. Testing /api/dashboard/per-level');
    const [perLevel] = await pool.execute(
      'SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL GROUP BY log_level'
    );
    
    const result = {};
    const allLevels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL'];
    allLevels.forEach(l => result[l] = 0);
    for (const r of perLevel) {
      const level = String(r.log_level || '').toUpperCase();
      if (result.hasOwnProperty(level)) {
        result[level] = r.cnt;
      }
    }
    
    console.log('   Per-level distribution:', result);
    console.log('   ✓ Per-level data retrieved\n');
    
    // Test 4: Check for NULL timestamps
    console.log('4. Checking for NULL timestamps');
    const [nullTimestamps] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM logs WHERE timestamp IS NULL AND imported_at IS NULL'
    );
    console.log('   Logs with NULL timestamp AND imported_at:', nullTimestamps[0].cnt);
    
    const [nullTimestampOnly] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM logs WHERE timestamp IS NULL AND imported_at IS NOT NULL'
    );
    console.log('   Logs with NULL timestamp but NOT NULL imported_at:', nullTimestampOnly[0].cnt);
    console.log('   ✓ Timestamp analysis complete\n');
    
  } catch (error) {
    console.error('❌ Error testing dashboard endpoints:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

async function testSearchEndpoint() {
  console.log('=== Testing Search Endpoint ===\n');
  
  try {
    // Test basic search
    console.log('1. Testing basic search query');
    const [searchResults] = await pool.execute(
      `SELECT id, timestamp, imported_at, log_level, source, service, message
       FROM logs
       ORDER BY COALESCE(timestamp, imported_at) DESC
       LIMIT 5`
    );
    
    console.log('   Search results count:', searchResults.length);
    if (searchResults.length > 0) {
      console.log('   Sample result:', {
        id: searchResults[0].id,
        timestamp: searchResults[0].timestamp,
        imported_at: searchResults[0].imported_at,
        log_level: searchResults[0].log_level
      });
    }
    console.log('   ✓ Search query executed\n');
    
    // Test with filters
    console.log('2. Testing search with level filter');
    const [filteredResults] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM logs WHERE log_level = 'ERROR'`
    );
    console.log('   ERROR logs count:', filteredResults[0].cnt);
    console.log('   ✓ Filtered search executed\n');
    
  } catch (error) {
    console.error('❌ Error testing search endpoint:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testWatcherStats() {
  console.log('=== Testing Watcher Stats ===\n');
  
  try {
    console.log('1. Testing getWatchStats query');
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN log_level = 'DEBUG' THEN 1 END) as debug_count,
        COUNT(CASE WHEN log_level = 'INFO' THEN 1 END) as info_count,
        COUNT(CASE WHEN log_level = 'WARNING' THEN 1 END) as warning_count,
        COUNT(CASE WHEN log_level = 'ERROR' THEN 1 END) as error_count,
        COUNT(CASE WHEN log_level = 'CRITICAL' THEN 1 END) as critical_count,
        COUNT(CASE WHEN log_level = 'FATAL' THEN 1 END) as fatal_count,
        COUNT(DISTINCT source) as sources,
        COUNT(DISTINCT service) as services,
        MIN(timestamp) as first_log,
        MAX(timestamp) as last_log
       FROM logs 
       WHERE user_id = 1 AND imported_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
    );
    
    console.log('   Stats:', stats[0]);
    console.log('   ✓ Watcher stats retrieved\n');
    
  } catch (error) {
    console.error('❌ Error testing watcher stats:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function main() {
  try {
    await testDashboardEndpoints();
    await testSearchEndpoint();
    await testWatcherStats();
    console.log('=== All Tests Completed ===');
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main();
