-- Script SQL correctif pour nettoyer le schéma MySQL Aiven
-- Ce script supprime les index/colonnes dupliqués qui causent les erreurs de migration
-- À exécuter MANUELLEMENT AVANT de relancer les migrations
--
-- IMPORTANT: Faire un backup avant exécution:
-- mysqldump -h HOST -u USER -p DBNAME > backup_before_cleanup.sql
--
-- NOTE: Ce script utilise DROP INDEX/DROP COLUMN sans IF EXISTS car MySQL ne supporte pas cette syntaxe.
-- Les erreurs ER_DUP_KEYNAME et ER_DUP_FIELDNAME dans les migrations normales sont gérées automatiquement.
-- Ce fichier est renommé en .manual.sql pour ne pas être exécut automatically.

-- ============================================
-- NETTOYAGE TABLE logs
-- ============================================

-- Supprimer les index dupliqués sur logs (basé sur les erreurs ER_DUP_KEYNAME observées)
-- ALTER TABLE logs DROP INDEX idx_logs_fingerprint;
-- ALTER TABLE logs DROP INDEX idx_logs_level;
-- ALTER TABLE logs DROP INDEX idx_logs_timestamp;
-- ALTER TABLE logs DROP INDEX idx_logs_user_timestamp;
-- ALTER TABLE logs DROP INDEX idx_logs_source_server;
-- ALTER TABLE logs DROP INDEX idx_logs_error_type;
-- ALTER TABLE logs DROP INDEX idx_logs_user_error_type_ts;
-- ALTER TABLE logs DROP INDEX idx_logs_user_fingerprint_ts;
-- ALTER TABLE logs DROP INDEX idx_logs_imported_at;
-- ALTER TABLE logs DROP INDEX idx_audit_severity;
-- ALTER TABLE logs DROP INDEX idx_audit_timestamp;
-- ALTER TABLE logs DROP INDEX idx_audit_source;
-- ALTER TABLE logs DROP INDEX idx_audit_user_id;
-- ALTER TABLE logs DROP INDEX idx_logs_combined_search;

-- Supprimer les colonnes dupliquées (basé sur les erreurs ER_DUP_FIELDNAME observées)
-- ALTER TABLE logs DROP COLUMN created_time;
-- ALTER TABLE logs DROP COLUMN imported_at;
-- ALTER TABLE logs DROP COLUMN timezone;
-- ALTER TABLE logs DROP COLUMN source_server;
-- ALTER TABLE logs DROP COLUMN parser_format;
-- ALTER TABLE logs DROP COLUMN timestamp_inferred;
-- ALTER TABLE logs DROP COLUMN classification_confidence;
-- ALTER TABLE logs DROP COLUMN created_at_log;
-- ALTER TABLE logs DROP COLUMN created_time_log;
-- ALTER TABLE logs DROP COLUMN imported_time;
-- ALTER TABLE logs DROP COLUMN file_created_at;
-- ALTER TABLE logs DROP COLUMN file_modified_at;

-- ============================================
-- NETTOYAGE TABLE error_groups
-- ============================================

-- Supprimer l'index fingerprint qui sera remplacé par idx_fingerprint_user
-- ALTER TABLE error_groups DROP INDEX fingerprint;
-- ALTER TABLE error_groups DROP INDEX idx_fingerprint_user;

-- Supprimer les colonnes dupliquées
-- ALTER TABLE error_groups DROP COLUMN previous_seen;
-- ALTER TABLE error_groups DROP COLUMN resolved_at;
-- ALTER TABLE error_groups DROP COLUMN returned_at;
-- ALTER TABLE error_groups DROP COLUMN return_count;
-- ALTER TABLE error_groups DROP COLUMN return_reason;
-- ALTER TABLE error_groups DROP COLUMN source_server;
-- ALTER TABLE error_groups DROP COLUMN service;
-- ALTER TABLE error_groups DROP COLUMN error_type;

-- Supprimer les index dupliqués
-- ALTER TABLE error_groups DROP INDEX idx_error_groups_status_last;
-- ALTER TABLE error_groups DROP INDEX idx_error_groups_error_type;

-- ============================================
-- NETTOYAGE TABLE alerts
-- ============================================

-- Supprimer les colonnes dupliquées
-- ALTER TABLE alerts DROP COLUMN resolved_at;

-- Supprimer les index dupliqués
-- ALTER TABLE alerts DROP INDEX idx_alerts_resolved;
-- ALTER TABLE alerts DROP INDEX idx_alerts_user_id;

-- ============================================
-- NETTOYAGE TABLE import_jobs
-- ============================================

-- Supprimer les colonnes dupliquées
-- ALTER TABLE import_jobs DROP COLUMN skipped_lines;
-- ALTER TABLE import_jobs DROP COLUMN import_source;
-- ALTER TABLE import_jobs DROP COLUMN import_service;
-- ALTER TABLE import_jobs DROP COLUMN import_summary;

-- ============================================
-- VÉRIFICATION POST-NETTOYAGE
-- ============================================

-- Afficher les index restants sur logs
-- SHOW INDEX FROM logs;

-- Afficher les colonnes de logs
-- SHOW COLUMNS FROM logs;

-- Afficher les index restants sur error_groups
-- SHOW INDEX FROM error_groups;

-- Afficher les colonnes de error_groups
-- SHOW COLUMNS FROM error_groups;

-- Afficher les index restants sur alerts
-- SHOW INDEX FROM alerts;

-- Afficher les colonnes de alerts
-- SHOW COLUMNS FROM alerts;
