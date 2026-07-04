-- Diagnostic migration to check user state
-- This will help identify why login is failing

SELECT '=== DIAGNOSTIC: Users Table ===' AS diagnostic;
SELECT id, email, display_name, role, is_active, created_at FROM users;

SELECT '=== DIAGNOSTIC: Password Hashes ===' AS diagnostic;
SELECT id, email, LEFT(password_hash, 20) as hash_prefix, LENGTH(password_hash) as hash_length FROM users;

SELECT '=== DIAGNOSTIC: Testing Hash ===' AS diagnostic;
-- The known correct hash for 'admin' is: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
SELECT 'Expected hash for admin: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' AS expected;
