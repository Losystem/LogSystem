#!/usr/bin/env node
/**
 * Test RAR Extraction — Diagnostic Tool
 * Vérifie que l'extraction RAR fonctionne correctement
 * Usage: node scripts/maintenance/test-rar-extraction.js [path-to-rar-file]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractArchive, detectArchiveType, filterLogFiles } from '../../lib/processing/archiveHandler.js';
import logger from '../../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testRARExtraction(filePath) {
  console.log('\n📦 RAR Extraction Test Suite');
  console.log('═'.repeat(50));
  
  if (!filePath) {
    console.log('\n❌ Erreur : Veuillez fournir le chemin d\'un fichier RAR');
    console.log('   Usage: node scripts/maintenance/test-rar-extraction.js file.rar');
    process.exit(1);
  }

  try {
    // 1. Vérifier que le fichier existe
    console.log(`\n✓ Test 1: Vérification du fichier`);
    const stats = await fs.stat(filePath);
    console.log(`  - Chemin: ${filePath}`);
    console.log(`  - Taille: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Type: ${stats.isFile() ? 'Fichier' : 'Dossier'}`);
    
    if (!stats.isFile()) {
      throw new Error('Le chemin doit pointér vers un fichier');
    }

    // 2. Charger le fichier en mémoire
    console.log(`\n✓ Test 2: Chargement du fichier`);
    const buffer = await fs.readFile(filePath);
    console.log(`  - Buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // 3. Détecter le type d'archive
    console.log(`\n✓ Test 3: Détection du type d'archive`);
    const archiveType = detectArchiveType(path.basename(filePath), buffer);
    console.log(`  - Type détecté: ${archiveType}`);
    
    if (archiveType !== 'rar') {
      console.log('  ⚠️  Attention : Le fichier n\'est pas un RAR valide');
      if (archiveType === null) {
        console.log('     Magic bytes: ' + buffer.slice(0, 4).toString('hex'));
      }
    }

    // 4. Extraire l'archive
    console.log(`\n✓ Test 4: Extraction de l'archive`);
    const startTime = Date.now();
    const extracted = await extractArchive(buffer, path.basename(filePath));
    const duration = Date.now() - startTime;
    
    console.log(`  - Fichiers extraits: ${extracted.length}`);
    console.log(`  - Temps d'extraction: ${duration}ms`);
    
    if (extracted.length === 0) {
      console.log('  ⚠️  Aucun fichier n\'a été extrait');
    }

    // 5. Filtrer les fichiers logs
    console.log(`\n✓ Test 5: Filtrage des fichiers logs`);
    const logFiles = filterLogFiles(extracted);
    console.log(`  - Fichiers logs trouvés: ${logFiles.length}/${extracted.length}`);
    
    extracted.forEach((file, idx) => {
      const isLog = logFiles.some(l => l.filename === file.filename);
      const marker = isLog ? '✅' : '❌';
      console.log(`    ${marker} ${file.filename} (${(file.content.length / 1024).toFixed(2)} KB)`);
    });

    // 6. Analyser les contenus
    console.log(`\n✓ Test 6: Analyse des contenus`);
    logFiles.slice(0, 3).forEach((file) => {
      const content = file.content.toString('utf-8', 0, Math.min(100, file.content.length));
      console.log(`\n  Fichier: ${file.filename}`);
      console.log(`  Encodage: UTF-8`);
      console.log(`  Aperçu: ${content.replace(/\n/g, '\n           ')}...`);
    });

    // 7. Résumé
    console.log(`\n✓ Test 7: Résumé`);
    console.log(`  - Total fichiers dans archive: ${extracted.length}`);
    console.log(`  - Fichiers logs valides: ${logFiles.length}`);
    console.log(`  - Taille totale décompressée: ${(extracted.reduce((sum, f) => sum + f.content.length, 0) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Temps total: ${duration}ms`);

    console.log(`\n✅ Tous les tests sont passés!`);
    console.log('═'.repeat(50));
    process.exit(0);

  } catch (error) {
    console.log(`\n❌ Test échoué:`);
    console.log(`  Erreur: ${error.message}`);
    if (error.code) console.log(`  Code: ${error.code}`);
    if (error.stack) console.log(`  Stack: ${error.stack}`);
    console.log('═'.repeat(50));
    process.exit(1);
  }
}

const filePath = process.argv[2];
testRARExtraction(filePath);
