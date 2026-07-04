-- Fix default user passwords to match "Admin@1234"
-- Previous hash in reset_platform.sql was incorrect

UPDATE users SET password_hash = '$2b$12$YbmoletlqnsHFcq9BtEmie6jccXLZdtIyLw5NgoNJemJ2Q/XQsVa' WHERE email = 'admin@logsystem.local';
UPDATE users SET password_hash = '$2b$12$YbmoletlqnsHFcq9BtEmie6jccXLZdtIyLw5NgoNJemJ2Q/XQsVa' WHERE email = 'user@logsystem.local';

SELECT 'Default passwords updated to Admin@1234' AS message;
