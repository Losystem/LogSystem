-- Migration pour corriger le schéma error_groups (Version idempotente)
-- Remplace UNIQUE(fingerprint) par UNIQUE(fingerprint + user_id)

-- ============================================
-- Supprimer l'ancienne contrainte UNIQUE si elle existe
-- ============================================

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND INDEX_NAME = 'fingerprint');
SET @sql = IF(@idx_exists > 0,
  'ALTER TABLE error_groups DROP INDEX fingerprint',
  'SELECT ''Index error_groups.fingerprint does not exist or already dropped''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- Ajouter la nouvelle contrainte UNIQUE sur (fingerprint, user_id)
-- ============================================

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'error_groups' AND INDEX_NAME = 'idx_fingerprint_user');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE error_groups ADD UNIQUE INDEX idx_fingerprint_user (fingerprint, user_id)',
  'SELECT ''Index error_groups.idx_fingerprint_user already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- Mettre à jour les enregistrements existants
-- ============================================

UPDATE error_groups 
SET user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) 
WHERE user_id IS NULL;
