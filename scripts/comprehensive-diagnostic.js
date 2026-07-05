/**
 * Diagnostic complet de la plateforme LogSystem
 * Vérifie tous les composants pour identifier les problèmes avant déploiement
 */

import pool from '../config/database.js';

async function checkDatabaseSchema() {
  console.log('=== Vérification du schéma de base de données ===\n');
  
  try {
    // Vérifier les tables principales
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('logs', 'users', 'alerts', 'error_groups', 'audit_log', 'import_jobs', 'alert_rules')
      ORDER BY TABLE_NAME
    `);
    
    console.log('Tables principales:');
    tables.forEach(t => {
      console.log(`  - ${t.TABLE_NAME}: ${t.TABLE_ROWS} lignes`);
    });
    
    // Vérifier les colonnes critiques de logs
    const [logColumns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs'
      AND COLUMN_NAME IN ('timestamp', 'imported_at', 'log_level', 'fingerprint', 'source', 'service', 'event_timestamp', 'source_system', 'main_service', 'hostname', 'log_origin')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColonnes critiques de logs:');
    logColumns.forEach(col => {
      const status = col.IS_NULLABLE === 'YES' ? 'NULLABLE' : 'NOT NULL';
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${status})`);
    });
    
    // Vérifier si audit_log existe
    const [auditTable] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_log'
    `);
    
    if (auditTable.length === 0) {
      console.log('\n⚠️  Table audit_log n\'existe PAS!');
    } else {
      console.log(`\n✅ Table audit_log existe: ${auditTable[0].TABLE_ROWS} lignes`);
      
      // Vérifier les colonnes de audit_log
      const [auditColumns] = await pool.execute(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_log'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('Colonnes de audit_log:');
      auditColumns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
      });
    }
    
    console.log('\n✅ Schéma vérifié\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du schéma:', error.message);
    return false;
  }
}

async function checkDataIntegrity() {
  console.log('=== Vérification de l\'intégrité des données ===\n');
  
  try {
    // Vérifier les logs avec NULL timestamps
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
    
    // Vérifier les logs par niveau
    const [levelCounts] = await pool.execute(
      'SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL GROUP BY log_level ORDER BY cnt DESC'
    );
    console.log('\nDistribution par niveau:');
    levelCounts.forEach(row => {
      console.log(`  - ${row.log_level}: ${row.cnt}`);
    });
    
    // Vérifier les alertes
    const [alertCounts] = await pool.execute(
      'SELECT status, COUNT(*) as cnt FROM alerts GROUP BY status'
    );
    console.log('\nAlertes par statut:');
    if (alertCounts.length === 0) {
      console.log('  ⚠️  Aucune alerte dans la base');
    } else {
      alertCounts.forEach(row => {
        console.log(`  - ${row.status}: ${row.cnt}`);
      });
    }
    
    // Vérifier les règles d'alerte
    const [ruleCounts] = await pool.execute(
      'SELECT is_active, COUNT(*) as cnt FROM alert_rules GROUP BY is_active'
    );
    console.log('\nRègles d\'alerte par statut:');
    if (ruleCounts.length === 0) {
      console.log('  ⚠️  Aucune règle d\'alerte dans la base');
    } else {
      ruleCounts.forEach(row => {
        console.log(`  - active=${row.is_active}: ${row.cnt}`);
      });
    }
    
    // Vérifier les imports récents
    const [recentImports] = await pool.execute(
      'SELECT COUNT(*) as cnt, MAX(created_at) as last_import FROM import_jobs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );
    console.log(`\nImports récentes (24h): ${recentImports[0].cnt}`);
    console.log(`Dernier import: ${recentImports[0].last_import}`);
    
    console.log('\n✅ Intégrité des données vérifiée\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de l\'intégrité:', error.message);
    return false;
  }
}

async function checkAuditLog() {
  console.log('=== Vérification du journal d\'audit ===\n');
  
  try {
    // Vérifier si la table existe
    const [tableExists] = await pool.execute(`
      SELECT COUNT(*) as cnt 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_log'
    `);
    
    if (tableExists[0].cnt === 0) {
      console.log('❌ Table audit_log n\'existe pas');
      
      // Créer la table si elle n'existe pas
      console.log('\nCréation de la table audit_log...');
      await pool.execute(`
        CREATE TABLE audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          user_email VARCHAR(255) NULL,
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100) NULL,
          resource_id VARCHAR(255) NULL,
          details TEXT NULL,
          ip_address VARCHAR(45) NULL,
          status VARCHAR(20) DEFAULT 'success',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_created_at (created_at),
          INDEX idx_resource_type (resource_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('✅ Table audit_log créée');
      return true;
    }
    
    // Vérifier le nombre d'entrées
    const [count] = await pool.execute('SELECT COUNT(*) as cnt FROM audit_log');
    console.log(`Nombre d'entrées dans audit_log: ${count[0].cnt}`);
    
    if (count[0].cnt === 0) {
      console.log('⚠️  Aucune entrée d\'audit - les événements ne sont pas enregistrés');
    } else {
      // Afficher les dernières entrées
      const [recent] = await pool.execute(
        'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5'
      );
      console.log('\nDernières entrées d\'audit:');
      recent.forEach(row => {
        console.log(`  - ${row.created_at}: ${row.action} par ${row.user_email || 'N/A'} (${row.status})`);
      });
    }
    
    console.log('\n✅ Audit log vérifié\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de l\'audit:', error.message);
    return false;
  }
}

async function checkTimestampQueries() {
  console.log('=== Vérification des requêtes timestamp ===\n');
  
  try {
    // Tester la requête de tendances avec COALESCE
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
       LIMIT 10`
    );
    
    console.log(`Test requête tendances: ${trends.length} résultats`);
    if (trends.length > 0) {
      console.log('Échantillon:');
      trends.slice(0, 3).forEach(row => {
        console.log(`  - ${row.day}: ${row.log_level} = ${row.cnt}`);
      });
    }
    
    // Tester la requête "today's logs"
    const todayStr = new Date().toISOString().slice(0, 10);
    const [todayLogs] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM logs WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ?`,
      [todayStr + ' 00:00:00']
    );
    console.log(`\nLogs d'aujourd'hui: ${todayLogs[0].cnt}`);
    
    console.log('\n✅ Requêtes timestamp vérifiées\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des requêtes timestamp:', error.message);
    return false;
  }
}

async function checkSearchFunctionality() {
  console.log('=== Vérification de la recherche ===\n');
  
  try {
    // Tester la recherche basique
    const [searchResults] = await pool.execute(
      `SELECT id, timestamp, imported_at, log_level, source, service, message
       FROM logs
       ORDER BY COALESCE(timestamp, imported_at) DESC
       LIMIT 5`
    );
    
    console.log(`Test recherche basique: ${searchResults.length} résultats`);
    if (searchResults.length > 0) {
      console.log('Échantillon:');
      searchResults.forEach(row => {
        console.log(`  - ID ${row.id}: ${row.log_level} | ${row.timestamp || row.imported_at}`);
      });
    }
    
    // Vérifier si l'index FULLTEXT existe
    const [ftIndex] = await pool.execute(`
      SELECT COUNT(*) as cnt 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_TYPE = 'FULLTEXT'
    `);
    
    console.log(`\nIndex FULLTEXT: ${ftIndex[0].cnt > 0 ? '✅ Présent' : '⚠️  Absent (recherche LIKE sera utilisée)'}`);
    
    console.log('\n✅ Recherche vérifiée\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la recherche:', error.message);
    return false;
  }
}

async function checkWatcherService() {
  console.log('=== Vérification du service Watcher ===\n');
  
  try {
    // Vérifier la table watch_offsets
    const [watchOffsets] = await pool.execute(`
      SELECT COUNT(*) as cnt 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'watch_offsets'
    `);
    
    if (watchOffsets[0].cnt === 0) {
      console.log('⚠️  Table watch_offsets n\'existe pas - le watcher ne peut pas fonctionner');
    } else {
      const [offsetCount] = await pool.execute('SELECT COUNT(*) as cnt FROM watch_offsets');
      console.log(`✅ Table watch_offsets existe: ${offsetCount[0].cnt} fichiers surveillés`);
    }
    
    // Vérifier si le watcher est désactivé sur Render
    const isRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME);
    console.log(`\nEnvironnement Render: ${isRender ? 'Oui (watcher désactivé)' : 'Non (watcher actif)'}`);
    
    console.log('\n✅ Watcher vérifié\n');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du watcher:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Démarrage du diagnostic complet de la plateforme\n');
  console.log('='.repeat(60) + '\n');
  
  const results = {
    schema: await checkDatabaseSchema(),
    integrity: await checkDataIntegrity(),
    audit: await checkAuditLog(),
    timestamps: await checkTimestampQueries(),
    search: await checkSearchFunctionality(),
    watcher: await checkWatcherService()
  };
  
  console.log('='.repeat(60));
  console.log('\n📊 Résumé du diagnostic:\n');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test}`);
  });
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 Tous les tests sont passés!');
  } else {
    console.log('\n⚠️ Certains tests ont échoué. Corrigez les problèmes identifiés.');
  }
  
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
