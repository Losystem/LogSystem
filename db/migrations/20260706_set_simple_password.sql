-- Set a very simple password for testing: "admin"
-- This is a known bcrypt hash for "admin" with rounds=10
-- Source: https://bcrypt-generator.com/

UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE email = 'admin@logsystem.local';
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE email = 'user@logsystem.local';

SELECT 'Password set to: admin' AS message;
