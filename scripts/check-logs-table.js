import pool from '../config/database.js';

async function checkLogsTable() {
  console.log('🔍 Vérification de la structure de la table logs...\n');
  
  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM logs');
    console.log('Colonnes de logs:');
    cols.forEach(c => {
      const extra = c.Extra ? ` (${c.Extra})` : '';
      console.log(`  - ${c.Field}: ${c.Type}${extra}`);
    });
    
    // Vérifier si id est AUTO_INCREMENT
    const idCol = cols.find(c => c.Field === 'id');
    if (!idCol) {
      console.log('\n❌ Colonne id manquante!');
    } else if (!idCol.Extra || !idCol.Extra.includes('auto_increment')) {
      console.log('\n⚠️  Colonne id n\'est pas AUTO_INCREMENT');
      console.log('Tentative de correction...');
      
      await pool.execute('ALTER TABLE logs MODIFY COLUMN id INT AUTO_INCREMENT');
      console.log('✅ Colonne id corrigée en AUTO_INCREMENT');
    } else {
      console.log('\n✅ Colonne id est correctement configurée en AUTO_INCREMENT');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkLogsTable();
