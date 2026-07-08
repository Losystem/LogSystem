#!/usr/bin/env node
/**
 * Archive Analyzer — Inspect archive contents
 * Usage: node scripts/tools/analyze-archive.js archive.rar
 */

import fs from 'fs/promises';
import path from 'path';
import { detectArchiveType, extractArchive, filterLogFiles } from '../../lib/processing/archiveHandler.js';

async function analyzeArchive(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const archiveType = detectArchiveType(path.basename(filePath), buffer);
    
    console.log(`\n📋 Archive Analysis: ${path.basename(filePath)}`);
    console.log(`Type: ${archiveType}`);
    console.log(`Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    const files = await extractArchive(buffer, path.basename(filePath));
    console.log(`Total Files: ${files.length}\n`);
    console.log('Contents:');
    files.forEach(file => {
      const isLog = /\.(log|txt|json|csv|xml)$/i.test(file.filename);
      const marker = isLog ? '📄' : '📦';
      console.log(`  ${marker} ${file.filename} - ${(file.content.length / 1024).toFixed(2)} KB`);
    });

    const logFiles = filterLogFiles(files);
    console.log(`\nLog Files: ${logFiles.length}/${files.length}`);
    
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node scripts/tools/analyze-archive.js <archive-file>');
  process.exit(1);
}

analyzeArchive(filePath);
