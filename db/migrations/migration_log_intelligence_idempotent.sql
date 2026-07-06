-- migration_log_intelligence.sql — Version idempotente pour Aiven MySQL
-- Utilise des procédures stockées pour vérifier l'existence avant ALTER/CREATE INDEX

-- ============================================
-- TABLE logs - Colonnes
-- ============================================

-- Ajouter colonne created_time si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'created_time');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN created_time TIME NULL AFTER timestamp',
  'SELECT ''Column logs.created_time already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne imported_at si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'imported_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN imported_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER created_time',
  'SELECT ''Column logs.imported_at already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne timezone si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'timezone');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN timezone VARCHAR(64) NULL AFTER imported_at',
  'SELECT ''Column logs.timezone already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne source_server si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'source_server');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN source_server VARCHAR(255) NULL AFTER source',
  'SELECT ''Column logs.source_server already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne parser_format si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'parser_format');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN parser_format VARCHAR(50) NULL AFTER target_user',
  'SELECT ''Column logs.parser_format already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne timestamp_inferred si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'timestamp_inferred');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN timestamp_inferred TINYINT(1) DEFAULT 0 AFTER parser_format',
  'SELECT ''Column logs.timestamp_inferred already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne classification_confidence si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'classification_confidence');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE logs ADD COLUMN classification_confidence DECIMAL(4,3) DEFAULT 0.500 AFTER timestamp_inferred',
  'SELECT ''Column logs.classification_confidence already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- TABLE logs - Updates
-- ============================================

UPDATE logs SET imported_at = COALESCE(imported_at, created_at, NOW());
UPDATE logs SET source_server = COALESCE(source_server, source);
UPDATE logs SET created_time = COALESCE(created_time, TIME(timestamp));

-- ============================================
-- TABLE logs - Indexes
-- ============================================

-- Ajouter index idx_logs_source_server s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_source_server');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_source_server (source_server)',
  'SELECT ''Index logs.idx_logs_source_server already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_error_type s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_error_type');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_error_type (error_type)',
  'SELECT ''Index logs.idx_logs_error_type already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_user_error_type_ts s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_user_error_type_ts');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_user_error_type_ts (user_id, error_type, timestamp DESC)',
  'SELECT ''Index logs.idx_logs_user_error_type_ts already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_user_fingerprint_ts s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_user_fingerprint_ts');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_user_fingerprint_ts (user_id, fingerprint, timestamp DESC)',
  'SELECT ''Index logs.idx_logs_user_fingerprint_ts already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_logs_imported_at s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND INDEX_NAME = 'idx_logs_imported_at');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE logs ADD INDEX idx_logs_imported_at (imported_at)',
  'SELECT ''Index logs.idx_logs_imported_at already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- TABLE error_groups - Colonnes
-- ============================================

-- Ajouter colonne previous_seen si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'previous_seen');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN previous_seen DATETIME NULL AFTER last_seen',
  'SELECT ''Column error_groups.previous_seen already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne resolved_at si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'resolved_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN resolved_at DATETIME NULL AFTER previous_seen',
  'SELECT ''Column error_groups.resolved_at already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne returned_at si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'returned_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN returned_at DATETIME NULL AFTER resolved_at',
  'SELECT ''Column error_groups.returned_at already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne return_count si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'return_count');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN return_count INT DEFAULT 0 AFTER returned_at',
  'SELECT ''Column error_groups.return_count already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne return_reason si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'return_reason');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN return_reason TEXT NULL AFTER return_count',
  'SELECT ''Column error_groups.return_reason already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne source_server si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'source_server');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN source_server VARCHAR(255) NULL AFTER return_reason',
  'SELECT ''Column error_groups.source_server already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne service si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'service');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN service VARCHAR(255) NULL AFTER source_server',
  'SELECT ''Column error_groups.service already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter colonne error_type si elle n'existe pas
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'error_type');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE error_groups ADD COLUMN error_type VARCHAR(100) NULL AFTER service',
  'SELECT ''Column error_groups.error_type already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- TABLE error_groups - Modify status enum
-- ============================================

-- Note: MODIFY COLUMN sur ENUM ne peut pas être idempotent simplement
-- On vérifie d'abord si la colonne a le bon type
SET @col_type = (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND COLUMN_NAME = 'status');
SET @sql = IF(@col_type NOT LIKE "%''open'',''resolved'',''returned''%",
  'ALTER TABLE error_groups MODIFY COLUMN status ENUM(''open'',''resolved'',''returned'') DEFAULT ''open''',
  'SELECT ''Column error_groups.status already has correct type''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- TABLE error_groups - Indexes
-- ============================================

-- Ajouter index idx_error_groups_status_last s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND INDEX_NAME = 'idx_error_groups_status_last');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE error_groups ADD INDEX idx_error_groups_status_last (status, last_seen DESC)',
  'SELECT ''Index error_groups.idx_error_groups_status_last already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajouter index idx_error_groups_error_type s'il n'existe pas
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND INDEX_NAME = 'idx_error_groups_error_type');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE error_groups ADD INDEX idx_error_groups_error_type (error_type)',
  'SELECT ''Index error_groups.idx_error_groups_error_type already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
