-- MIGRATION V4 → V5 (Version idempotente pour Aiven MySQL)
-- Utilise des procédures stockées pour vérifier l'existence avant ALTER/CREATE INDEX

-- ============================================
-- TABLE alerts
-- ============================================

-- Ajouter colonne resolved_at si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'alerts' AND COLUMN_NAME = 'resolved_at');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE alerts ADD COLUMN resolved_at DATETIME NULL DEFAULT NULL AFTER read_at',
  'SELECT ''Column alerts.resolved_at already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_alerts_resolved s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'alerts' AND INDEX_NAME = 'idx_alerts_resolved');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE alerts ADD INDEX idx_alerts_resolved (resolved_at)',
  'SELECT ''Index alerts.idx_alerts_resolved already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- TABLE import_jobs
-- ============================================

-- Ajouter colonne skipped_lines si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'import_jobs' AND COLUMN_NAME = 'skipped_lines');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE import_jobs ADD COLUMN skipped_lines INT DEFAULT 0 AFTER error_message',
  'SELECT ''Column import_jobs.skipped_lines already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne import_source si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'import_jobs' AND COLUMN_NAME = 'import_source');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE import_jobs ADD COLUMN import_source VARCHAR(255) AFTER skipped_lines',
  'SELECT ''Column import_jobs.import_source already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne import_service si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'import_jobs' AND COLUMN_NAME = 'import_service');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE import_jobs ADD COLUMN import_service VARCHAR(255) AFTER import_source',
  'SELECT ''Column import_jobs.import_service already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- TABLE watch_offsets
-- ============================================

CREATE TABLE IF NOT EXISTS watch_offsets (
  path_hash  CHAR(64) PRIMARY KEY,
  path       TEXT NOT NULL,
  offset     BIGINT       DEFAULT 0,
  updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- MISE À JOUR alert_rules
-- ============================================

UPDATE alert_rules
SET created_by = (SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id ASC LIMIT 1)
WHERE created_by IS NULL;

-- ============================================
-- TABLE logs - Indexes
-- ============================================

-- Ajouter index idx_logs_user_timestamp s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_user_timestamp');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_user_timestamp (user_id, timestamp)',
  'SELECT ''Index logs.idx_logs_user_timestamp already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_fingerprint s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_fingerprint');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_fingerprint (fingerprint)',
  'SELECT ''Index logs.idx_logs_fingerprint already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_level s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_level');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_level (log_level)',
  'SELECT ''Index logs.idx_logs_level already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_timestamp s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_timestamp');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_timestamp (timestamp)',
  'SELECT ''Index logs.idx_logs_timestamp already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
