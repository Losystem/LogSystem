/**
 * Script d'import de données de test pour LogSystem
 * Génère des logs réalistes pour tester toutes les fonctionnalités
 */

import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { generateFingerprint } from '../lib/processing/fingerprint.js';
import { normalizeLevel } from '../config/database.js';

const TEST_LOGS = [
  // Logs INFO
  { level: 'INFO', message: 'Application started successfully', service: 'Application', source: 'app.log' },
  { level: 'INFO', message: 'User login successful: user123', service: 'Authentication', source: 'auth.log' },
  { level: 'INFO', message: 'Database connection established', service: 'Database', source: 'db.log' },
  { level: 'INFO', message: 'Cache initialized with 1000 entries', service: 'Cache', source: 'cache.log' },
  { level: 'INFO', message: 'API server listening on port 3000', service: 'API', source: 'api.log' },
  
  // Logs WARNING
  { level: 'WARNING', message: 'High memory usage detected: 85%', service: 'System', source: 'system.log' },
  { level: 'WARNING', message: 'Slow query detected: 2.5s', service: 'Database', source: 'db.log' },
  { level: 'WARNING', message: 'Rate limit approaching for user456', service: 'API', source: 'api.log' },
  { level: 'WARNING', message: 'Disk space low: 15% remaining', service: 'System', source: 'system.log' },
  { level: 'WARNING', message: 'Connection pool exhausted', service: 'Database', source: 'db.log' },
  
  // Logs ERROR
  { level: 'ERROR', message: 'Failed to connect to external API', service: 'API', source: 'api.log' },
  { level: 'ERROR', message: 'Database query timeout after 30s', service: 'Database', source: 'db.log' },
  { level: 'ERROR', message: 'Authentication failed for user789', service: 'Authentication', source: 'auth.log' },
  { level: 'ERROR', message: 'File not found: /var/log/missing.log', service: 'File System', source: 'fs.log' },
  { level: 'ERROR', message: 'Invalid JSON payload received', service: 'API', source: 'api.log' },
  
  // Logs CRITICAL
  { level: 'CRITICAL', message: 'Database connection lost', service: 'Database', source: 'db.log' },
  { level: 'CRITICAL', message: 'Out of memory error', service: 'System', source: 'system.log' },
  { level: 'CRITICAL', message: 'Primary server unreachable', service: 'Network', source: 'network.log' },
  
  // Logs FATAL
  { level: 'FATAL', message: 'Application crash - unhandled exception', service: 'Application', source: 'app.log' },
  { level: 'FATAL', message: 'Kernel panic detected', service: 'System', source: 'system.log' },
];

const SERVICES = ['Application', 'Authentication', 'Database', 'API', 'Cache', 'System', 'Network', 'File System'];
const SOURCES = ['app.log', 'auth.log', 'db.log', 'api.log', 'cache.log', 'system.log', 'network.log', 'fs.log'];

function generateTimestamp(offsetMinutes = 0) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - offsetMinutes);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function insertTestLogs() {
  console.log('🔧 Génération et import des logs de test...\n');
  
  try {
    // Obtenir un utilisateur existant pour user_id
    const [users] = await pool.execute('SELECT id FROM users WHERE is_active = 1 LIMIT 1');
    const userId = users.length > 0 ? users[0].id : 1;
    
    // Créer un job d'import
    const [jobResult] = await pool.execute(
      'INSERT INTO import_jobs (user_id, filename, status, created_at) VALUES (?, ?, ?, NOW())',
      [userId, 'test-data.log', 'completed']
    );
    const importJobId = jobResult.insertId;
    
    console.log(`Job d'import créé: #${importJobId}`);
    
    // Générer des logs sur les 7 derniers jours
    const logsToInsert = [];
    let logCount = 0;
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        // Générer 5-10 logs par heure
        const logsPerHour = 5 + Math.floor(Math.random() * 5);
        
        for (let i = 0; i < logsPerHour; i++) {
          const template = TEST_LOGS[Math.floor(Math.random() * TEST_LOGS.length)];
          const offsetMinutes = (day * 24 * 60) + (hour * 60) + Math.floor(Math.random() * 60);
          
          const log = {
            timestamp: generateTimestamp(offsetMinutes),
            imported_at: generateTimestamp(Math.floor(Math.random() * 10)), // Importé récemment
            log_level: normalizeLevel(template.level),
            message: template.message,
            service: template.service,
            source: template.source,
            source_server: `server-${Math.floor(Math.random() * 5) + 1}`,
            user_id: userId,
            import_job_id: importJobId,
            fingerprint: generateFingerprint(template.service, 'generic', template.message.toLowerCase()),
            event_type: template.level === 'ERROR' || template.level === 'CRITICAL' || template.level === 'FATAL' ? 'error' : 'info',
            parser_format: 'test',
            timestamp_inferred: 0,
            classification_confidence: 0.9
          };
          
          logsToInsert.push(log);
          logCount++;
        }
      }
    }
    
    console.log(`Génération de ${logCount} logs de test...`);
    
    // Insérer les logs par lots (INSERT individuels pour éviter le problème avec AUTO_INCREMENT)
    const batchSize = 50;
    for (let i = 0; i < logsToInsert.length; i += batchSize) {
      const batch = logsToInsert.slice(i, i + batchSize);
      
      for (const log of batch) {
        await pool.execute(
          `INSERT INTO logs (timestamp, imported_at, log_level, message, service, source, source_server, user_id, import_job_id, fingerprint, event_type, parser_format, timestamp_inferred, classification_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            log.timestamp,
            log.imported_at,
            log.log_level,
            log.message,
            log.service,
            log.source,
            log.source_server,
            log.user_id,
            log.import_job_id,
            log.fingerprint,
            log.event_type,
            log.parser_format,
            log.timestamp_inferred,
            log.classification_confidence
          ]
        );
      }
      
      console.log(`  Progression: ${Math.min(i + batchSize, logsToInsert.length)}/${logsToInsert.length}`);
    }
    
    // Mettre à jour le job d'import
    await pool.execute(
      'UPDATE import_jobs SET status = ?, processed_lines = ?, error_count = 0, completed_at = NOW() WHERE id = ?',
      ['completed', logCount, importJobId]
    );
    
    console.log(`\n✅ ${logCount} logs importés avec succès!`);
    console.log(`Job d'import #${importJobId} marqué comme terminé`);
    
    // Vérifier les statistiques
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN log_level = 'ERROR' THEN 1 END) as errors,
        COUNT(CASE WHEN log_level = 'WARNING' THEN 1 END) as warnings,
        COUNT(CASE WHEN log_level = 'CRITICAL' THEN 1 END) as critical,
        COUNT(CASE WHEN log_level = 'FATAL' THEN 1 END) as fatal
      FROM logs
    `);
    
    console.log('\n📊 Statistiques après import:');
    console.log(`  Total logs: ${stats[0].total}`);
    console.log(`  Erreurs: ${stats[0].errors}`);
    console.log(`  Warnings: ${stats[0].warnings}`);
    console.log(`  Critiques: ${stats[0].critical}`);
    console.log(`  Fatals: ${stats[0].fatal}`);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des logs de test:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Script d\'import de données de test pour LogSystem\n');
  console.log('='.repeat(60) + '\n');
  
  const success = await insertTestLogs();
  
  console.log('\n' + '='.repeat(60));
  
  if (success) {
    console.log('\n🎉 Import des données de test terminé avec succès!');
    console.log('Vous pouvez maintenant tester le dashboard et les autres fonctionnalités.');
  } else {
    console.log('\n❌ Échec de l\'import des données de test.');
  }
  
  await pool.end();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
