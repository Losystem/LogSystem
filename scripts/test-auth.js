/**
 * Test script to diagnose authentication issues
 * Run this locally with: node scripts/test-auth.js
 * Or on Render with: node scripts/test-auth.js (after deployment)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testAuth() {
  console.log('=== AUTHENTICATION DIAGNOSTIC ===\n');
  
  // 1. Test database connection
  console.log('1. Testing database connection...');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
    
    console.log('✅ Database connection successful');
    
    // 2. Check users table
    console.log('\n2. Checking users table...');
    const [users] = await connection.execute('SELECT id, email, display_name, role, is_active, LEFT(password_hash, 20) as hash_prefix, LENGTH(password_hash) as hash_length FROM users');
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`✅ Found ${users.length} user(s):`);
      users.forEach(user => {
        console.log(`   - ID: ${user.id}, Email: ${user.email}, Active: ${user.is_active}, Hash prefix: ${user.hash_prefix}, Length: ${user.hash_length}`);
      });
    }
    
    // 3. Test password comparison
    console.log('\n3. Testing password comparison...');
    const testPassword = 'admin';
    const expectedHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    
    console.log(`   Test password: "${testPassword}"`);
    console.log(`   Expected hash: ${expectedHash}`);
    
    for (const user of users) {
      const [fullHash] = await connection.execute('SELECT password_hash FROM users WHERE id = ?', [user.id]);
      const actualHash = fullHash[0].password_hash;
      
      console.log(`\n   Testing user: ${user.email}`);
      console.log(`   Actual hash: ${actualHash}`);
      
      try {
        const isValid = await bcrypt.compare(testPassword, actualHash);
        console.log(`   bcrypt.compare result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      } catch (error) {
        console.log(`   bcrypt.compare error: ${error.message}`);
      }
      
      // Also test with expected hash
      const expectedValid = await bcrypt.compare(testPassword, expectedHash);
      console.log(`   Expected hash comparison: ${expectedValid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
    // 4. Test with different passwords
    console.log('\n4. Testing with different passwords...');
    const testPasswords = ['admin', 'Admin@1234', 'password', ''];
    
    for (const user of users) {
      const [fullHash] = await connection.execute('SELECT password_hash FROM users WHERE id = ?', [user.id]);
      const actualHash = fullHash[0].password_hash;
      
      console.log(`\n   User: ${user.email}`);
      for (const pwd of testPasswords) {
        try {
          const isValid = await bcrypt.compare(pwd, actualHash);
          console.log(`   Password "${pwd}": ${isValid ? '✅ VALID' : '❌ INVALID'}`);
        } catch (error) {
          console.log(`   Password "${pwd}": ERROR - ${error.message}`);
        }
      }
    }
    
    await connection.end();
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAuth();
