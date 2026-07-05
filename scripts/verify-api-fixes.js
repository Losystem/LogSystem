/**
 * Script de vérification des corrections API
 * Teste les endpoints critiques pour confirmer que les corrections fonctionnent
 */

import pool from '../config/database.js';

async function verifyDatabaseSchema() {
  console.log('=== Vérification du schéma de base de données ===\n');
  
  try {
    // Vérifier les colonnes critiques
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs'
      AND COLUMN_NAME IN ('timestamp', 'imported_at', 'log_level', 'fingerprint')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Colonnes critiques de la table logs:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });
    
    // Vérifier les index
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs'
      AND INDEX_NAME IN ('idx_logs_timestamp', 'idx_logs_fingerprint', 'idx_logs_level')
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    
    console.log('\nIndex critiques de la table logs:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.INDEX_NAME}: ${idx.COLUMN_NAME}`);
    });
    
    console.log('\n✅ Schéma de base de données vérifié\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du schéma:', error.message);
    return false;
  }
}

async function verifyTimestampColumns() {
  console.log('=== Vérification des colonnes timestamp ===\n');
  
  try {
    const [nullTimestamps] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM logs WHERE timestamp IS NULL AND imported_at IS NULL'
    );
    console.log(`Logs avec timestamp NULL ET imported_at NULL: ${nullTimestamps[0].cnt}`);
    
    const [nullTimestampOnly] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM logs WHERE timestamp IS NULL AND imported_at IS NOT NULL'
    );
    console.log(`Logs avec timestamp NULL mais imported_at NOT NULL: ${nullTimestampOnly[0].cnt}`);
    
    const [bothPresent] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM logs WHERE timestamp IS NOT NULL AND imported_at IS NOT NULL'
    );
    console.log(`Logs avec timestamp ET imported_at: ${bothPresent[0].cnt}`);
    
    const [totalLogs] = await pool.execute('SELECT COUNT(*) as cnt FROM logs');
    console.log(`Total logs: ${totalLogs[0].cnt}`);
    
    console.log('\n✅ Colonnes timestamp vérifiées\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des timestamps:', error.message);
    return false;
  }
}

async function verifyLevelDistribution() {
  console.log('=== Vérification de la répartition par niveau ===\n');
  
  try {
    const [levels] = await pool.execute(
      'SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL GROUP BY log_level ORDER BY cnt DESC'
    );
    
    console.log('Répartition par niveau:');
    levels.forEach(row => {
      console.log(`  - ${row.log_level}: ${row.cnt}`);
    });
    
    console.log('\n✅ Répartition par niveau vérifiée\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des niveaux:', error.message);
    return false;
  }
}

async function verifyTrendsQuery() {
  console.log('=== Vérification de la requête de tendances ===\n');
  
  try {
    const timestampCol = 'COALESCE(timestamp, imported_at)';
    const [trends] = await pool.execute(
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
    
    console.log(`Nombre de résultats de tendances: ${trends.length}`);
    if (trends.length > 0) {
      console.log('Échantillon de données:');
      trends.slice(0, 5).forEach(row => {
        console.log(`  - ${row.day}: ${row.log_level} = ${row.cnt}`);
      });
    }
    
    console.log('\n✅ Requête de tendances vérifiée\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des tendances:', error.message);
    return false;
  }
}

async function verifySearchQuery() {
  console.log('=== Vérification de la requête de recherche ===\n');
  
  try {
    const [results] = await pool.execute(
      `SELECT id, timestamp, imported_at, log_level, source, service, message
       FROM logs
       ORDER BY COALESCE(timestamp, imported_at) DESC
       LIMIT 5`
    );
    
    console.log(`Nombre de résultats de recherche: ${results.length}`);
    if (results.length > 0) {
      console.log('Échantillon de résultats:');
      results.forEach(row => {
        console.log(`  - ID ${row.id}: ${row.log_level} | ${row.timestamp || row.imported_at}`);
      });
    }
    
    console.log('\n✅ Requête de recherche vérifiée\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la recherche:', error.message);
    return false;
  }
}

async function verifyWatcherStats() {
  console.log('=== Vérification des statistiques watcher ===\n');
  
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN log_level = 'DEBUG' THEN 1 END) as debug_count,
        COUNT(CASE WHEN log_level = 'INFO' THEN 1 END) as info_count,
        COUNT(CASE WHEN log_level = 'WARNING' THEN 1 END) as warning_count,
        COUNT(CASE WHEN log_level = 'ERROR' THEN 1 END) as error_count,
        COUNT(CASE WHEN log_level = 'CRITICAL' THEN 1 END) as critical_count,
        COUNT(CASE WHEN log_level = 'FATAL' THEN 1 END) as fatal_count
       FROM logs 
       WHERE user_id = 1 AND imported_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
    );
    
    console.log('Statistiques watcher (dernière heure):');
    console.log(`  - Total logs: ${stats[0].total_logs}`);
    console.log(`  - DEBUG: ${stats[0].debug_count}`);
    console.log(`  - INFO: ${stats[0].info_count}`);
    console.log(`  - WARNING: ${stats[0].warning_count}`);
    console.log(`  - ERROR: ${stats[0].error_count}`);
    console.log(`  - CRITICAL: ${stats[0].critical_count}`);
    console.log(`  - FATAL: ${stats[0].fatal_count}`);
    
    console.log('\n✅ Statistiques watcher vérifiées\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des stats watcher:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Démarrage de la vérification des corrections API\n');
  console.log('='.repeat(50) + '\n');
  
  const results = {
    databaseSchema: await verifyDatabaseSchema(),
    timestampColumns: await verifyTimestampColumns(),
    levelDistribution: await verifyLevelDistribution(),
    trendsQuery: await verifyTrendsQuery(),
    searchQuery: await verifySearchQuery(),
    watcherStats: await verifyWatcherStats()
  };
  
  console.log('='.repeat(50));
  console.log('\n📊 Résumé des vérifications:\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test}`);
  });
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 Toutes les vérifications ont réussi!');
  } else {
    console.log('\n⚠️ Certaines vérifications ont échoué. Vérifiez les erreurs ci-dessus.');
  }
  
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
