-- Update user passwords to use correct bcrypt hash for "admin"
-- This migration fixes the incorrect hash from previous reset

UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE email = 'admin@logsystem.local';
UPDATE users SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' WHERE email = 'user@logsystem.local';

SELECT 'Password updated to: admin' AS message;
