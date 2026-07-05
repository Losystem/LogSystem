/**
 * Script de nettoyage de la base de données Aiven
 * Exécute le script cleanup_duplicate_schema.sql via la connexion pool existante
 */

import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeCleanupScript() {
  console.log('🔧 Démarrage du nettoyage de la base de données...\n');
  
  try {
    // Lire le script SQL
    const scriptPath = path.join(__dirname, '../db/migrations/cleanup_duplicate_schema.sql');
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');
    
    console.log('📄 Script SQL chargé:', scriptPath);
    console.log('📏 Taille du script:', sqlScript.length, 'caractères\n');
    
    // Diviser le script en instructions individuelles
    // Ignorer les commentaires et les instructions SHOW
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Ignorer les lignes vides et les commentaires
        if (!stmt || stmt.startsWith('--') || stmt.startsWith('#')) return false;
        // Ignorer les instructions SHOW (informationnelles)
        if (stmt.toUpperCase().startsWith('SHOW')) return false;
        return true;
      });
    
    console.log(`📋 ${statements.length} instructions à exécuter\n`);
    
    // Exécuter chaque instruction
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      
      try {
        console.log(`[${i + 1}/${statements.length}] Exécution: ${stmt.substring(0, 60)}...`);
        await pool.execute(stmt);
        console.log(`  ✅ Succès\n`);
        successCount++;
      } catch (error) {
        // Certaines erreurs sont attendues (IF NOT EXISTS sur MySQL)
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME' || 
            error.code === 'ER_CANT_DROP_FIELD_OR_KEY' || error.code === 'ER_BAD_TABLE_ERROR') {
          console.log(`  ⚠️  Erreur attendue (élément déjà inexistant): ${error.code}\n`);
          successCount++; // Considérer comme succès car l'état final est correct
        } else {
          console.log(`  ❌ Erreur: ${error.code} - ${error.message}\n`);
          errorCount++;
        }
      }
    }
    
    console.log('='.repeat(50));
    console.log('\n📊 Résumé du nettoyage:');
    console.log(`  ✅ Instructions réussies: ${successCount}`);
    console.log(`  ❌ Erreurs: ${errorCount}`);
    console.log(`  📋 Total: ${statements.length}\n`);
    
    // Afficher l'état final des tables
    console.log('🔍 État final des tables:\n');
    
    try {
      const [logsIndexes] = await pool.execute('SHOW INDEX FROM logs');
      console.log(`Table logs: ${logsIndexes.length} index`);
      
      const [logsColumns] = await pool.execute('SHOW COLUMNS FROM logs');
      console.log(`Table logs: ${logsColumns.length} colonnes`);
      
      const [errorGroupsIndexes] = await pool.execute('SHOW INDEX FROM error_groups');
      console.log(`Table error_groups: ${errorGroupsIndexes.length} index`);
      
      const [errorGroupsColumns] = await pool.execute('SHOW COLUMNS FROM error_groups');
      console.log(`Table error_groups: ${errorGroupsColumns.length} colonnes`);
      
    } catch (error) {
      console.log('⚠️  Impossible de vérifier l\'état final:', error.message);
    }
    
    console.log('\n✅ Nettoyage terminé!');
    
    if (errorCount > 0) {
      console.log('\n⚠️  Certaines erreurs ont été rencontrées. Vérifiez les logs ci-dessus.');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur fatale lors du nettoyage:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

executeCleanupScript();
