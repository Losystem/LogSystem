# Instructions de nettoyage et correction de la base de données MySQL Aiven

## Problème identifié

Les migrations échouent avec des erreurs `ER_DUP_KEYNAME` et `ER_DUP_FIELDNAME` car des index et colonnes existent déjà dans la base de données, causant des conflits lors des ALTER TABLE.

## Solution en 3 étapes

### Étape 1: Backup de la base de données (OBLIGATOIRE)

```bash
# Depuis votre machine locale avec accès SSL à Aiven
mysqldump -h <AIVEN_HOST> -u <USER> -p <DBNAME> > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).sql
```

### Étape 2: Exécuter le script de nettoyage

```bash
# Connectez-vous à votre base Aiven via MySQL client
mysql -h <AIVEN_HOST> -u <USER> -p <DBNAME> < db/migrations/cleanup_duplicate_schema.sql
```

Ce script va :
- Supprimer tous les index dupliqués sur les tables `logs`, `error_groups`, `alerts`, `import_jobs`
- Supprimer toutes les colonnes dupliquées
- Afficher l'état final du schéma pour vérification

### Étape 3: Remplacer les migrations par les versions idempotentes

Remplacez les fichiers de migration originaux par leurs versions idempotentes :

```bash
# Backup des originaux
mv db/migrations/migrate_v4_to_v5.sql db/migrations/migrate_v4_to_v5.sql.backup
mv db/migrations/migration_errorgroups_fix.sql db/migrations/migration_errorgroups_fix.sql.backup
mv db/migrations/migration_log_intelligence.sql db/migrations/migration_log_intelligence.sql.backup

# Utiliser les versions idempotentes
mv db/migrations/migrate_v4_to_v5_idempotent.sql db/migrations/migrate_v4_to_v5.sql
mv db/migrations/migration_errorgroups_fix_idempotent.sql db/migrations/migration_errorgroups_fix.sql
mv db/migrations/migration_log_intelligence_idempotent.sql db/migrations/migration_log_intelligence.sql
```

### Étape 4: Relancer les migrations

```bash
# Depuis l'application ou en exécutant manuellement
node -e "import('./config/database.js').then(async ({ pool }) => { const fs = await import('fs'); const path = await import('path'); const migrations = ['migrate_v4_to_v5.sql', 'migration_errorgroups_fix.sql', 'migration_log_intelligence.sql']; for (const m of migrations) { const sql = fs.readFileSync(path.join('db/migrations', m), 'utf8'); await pool.execute(sql); console.log('✓', m); } await pool.end(); }).catch(console.error);"
```

Ou simplement redéployer sur Render, les migrations s'exécuteront automatiquement.

## Vérification post-nettoyage

Après exécution, vérifiez que :

1. ✅ Aucune erreur `ER_DUP_*` dans les logs de migration
2. ✅ Les tables ont les colonnes attendues
3. ✅ Les index sont présents et uniques
4. ✅ L'application démarre sans erreur

## Scripts créés

- **cleanup_duplicate_schema.sql** - Nettoyage complet du schéma
- **migrate_v4_to_v5_idempotent.sql** - Migration idempotente V4→V5
- **migration_errorgroups_fix_idempotent.sql** - Correction error_groups idempotente
- **migration_log_intelligence_idempotent.sql** - Migration log intelligence idempotente

## Notes importantes

- Les versions idempotentes utilisent `INFORMATION_SCHEMA` pour vérifier l'existence avant création
- Elles sont sûres à exécuter plusieurs fois
- Compatible avec Aiven MySQL (pas de IF NOT EXISTS sur ALTER TABLE)
- Conserve toutes les données existantes

## Prochaines étapes après nettoyage DB

1. Configurer Redis pour le cache
2. Vérifier l'authentification avec bcryptjs
3. Tester les imports de fichiers
4. Vérifier le dashboard et WatchLog
