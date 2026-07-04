-- Update user passwords to use correct bcryptjs hash for "admin"
-- This migration fixes the incorrect hash from previous reset
-- Hash generated with bcryptjs (not bcrypt) for compatibility

UPDATE users SET password_hash = '$2b$10$BUbTr//OgvZgrDYmmQqaGOT1x2sHXZVOt2Q6FCJbLGczZev9uxcha' WHERE email = 'admin@logsystem.local';
UPDATE users SET password_hash = '$2b$10$BUbTr//OgvZgrDYmmQqaGOT1x2sHXZVOt2Q6FCJbLGczZev9uxcha' WHERE email = 'user@logsystem.local';

SELECT 'Password updated to: admin (bcryptjs compatible)' AS message;
