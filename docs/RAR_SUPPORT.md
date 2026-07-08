# Support des Archives RAR — Guide Complet

## 🎯 Vue d'ensemble

LogSystem v6.0+ supporte nativement les archives **RAR** pour l'importation de fichiers logs. Ce guide explique comment utiliser et dépanner la fonctionnalité.

## ✅ Formats d'archives supportés

| Format | Extension | MIME Type | Statut |
|--------|-----------|-----------|--------|
| **ZIP** | `.zip` | `application/zip` | ✅ Supporté |
| **GZIP** | `.gz`, `.gzip` | `application/gzip` | ✅ Supporté |
| **TAR.GZ** | `.tar.gz`, `.tgz` | N/A | ✅ Supporté |
| **TAR** | `.tar` | `application/x-tar` | ✅ Supporté |
| **RAR** | `.rar` | `application/vnd.rar` | ✅ Supporté |
| **7Z** | `.7z` | `application/x-7z-compressed` | ✅ Supporté |
| **BZ2** | `.bz2` | N/A | ✅ Supporté |
| **XZ** | `.xz` | N/A | ✅ Supporté |

## 🚀 Utilisation RAR

### Via l'interface web

1. Accédez au **Dashboard**
2. Cliquez sur **"Importer des logs"**
3. Sélectionnez votre fichier RAR
4. Remplissez les paramètres optionnels :
   - **Source** : serveur/système source
   - **Service** : nom du service
   - **Locale** : format de date (fr, en, etc.)
5. Cliquez **"Télécharger"**

### Limitations actuelles

⚠️ **Archives chiffrées** : Non supportées
- Les archives RAR protégées par mot de passe sont rejetées
- Message d'erreur : `"Archive protégée par mot de passe — non supportée."` 

## 🔧 Architecture technique

### Stack technologique

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (upload.js)                                    │
│ ↓                                                        │
│ POST /api/import/upload (multer)                        │
│ ↓                                                        │
│ archiveHandler.js                                       │
│ ├─ Détection du type (magic bytes + extension)          │
│ ├─ Routage vers le bon extracteur                       │
│ └─ Filtrage des fichiers logs                           │
│ ├─ ZIP (unzipper)                                       │
│ ├─ RAR (node-unrar-js WASM) ⭐ Notre focus              │
│ ├─ 7Z (7zip-bin CLI)                                    │
│ └─ GZIP/TAR (zlib + 7z)                                 │
│ ↓                                                        │
│ import.js                                                │
│ ├─ Parsing universel (universalParser.js)               │
│ ├─ Normalisation des données                            │
│ └─ Insertion batch en base de données                   │
└─────────────────────────────────────────────────────────┘
```

### Dépendances clés

```json
{
  "node-unrar-js": "^2.0.0",    // Extraction RAR (WASM)
  "7zip-bin": "^5.2.0",         // Support 7Z/TAR
  "unzipper": "^0.10.14",       // Support ZIP
  "multer": "^2.0.0",           // Upload multi-fichiers
  "decompress": "^4.2.1"        // Fallback générique
}
```

## 🔍 Détection et décodage RAR

### Magic bytes (signature)

```javascript
// Détection au niveau des octets
const isRAR = buffer[0] === 0x52 &&  // 'R'
              buffer[1] === 0x61 &&  // 'a'
              buffer[2] === 0x72 &&  // 'r'
              buffer[3] === 0x21;    // '!'
```

### Processus d'extraction

1. **Chargement du WASM** : node-unrar-js charge dynamiquement unrar.wasm
2. **Vérification du chiffrement** : Rejet si fileHeader.flags.encrypted
3. **Liste des fichiers** : extractor.getFileList()
4. **Filtrage** : Garde uniquement les .log, .txt, .json, .csv, .xml
5. **Extraction** : extractor.extract({ files: [...] })
6. **Conversion en Buffer** : Buffer.from(file.extraction)

## 🐛 Dépannage

### Erreur : "Archive protégée par mot de passe"

**Cause** : Le fichier RAR a un mot de passe

**Solution** :

```bash
# Déverrouiller avec WinRAR ou unrar CLI
unrar x -pMOT_DE_PASSE archive.rar

# Recréer sans chiffrement
rar a -ep1 archive_new.rar *.log
```

### Erreur : "Archive invalide ou corrompue"

**Cause** : Fichier RAR corrompu ou partiellement téléchargé

**Diagnostic** :

```bash
# Vérifier l'intégrité
unrar t archive.rar

# Tester l'extraction
unrar x -y archive.rar /tmp/test/
```

**Solution** : Retélécharger le fichier

### Erreur : "Aucun fichier log trouvé"

**Cause** : L'archive ne contient pas de fichiers .log, .txt, etc.

**Solution** : Vérifier le contenu

```bash
unrar l archive.rar

# Créer une archive valide
rar a -r archive.rar logs/
```

### Extraction RAR non disponible

**Cause** : Le WASM n'a pas pu être chargé

**Diagnostic** : Vérifier les logs serveur

```bash
grep -i "unrar_wasm" logs/logsystem.log
```

**Solution** :

```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Redémarrer
npm start
```

## 📊 Exemple : Archive multi-fichiers

```
archive.rar
├── app_2024-01-15.log       ✅ Importé
├── app_2024-01-16.log       ✅ Importé
├── config.xml               ✅ Importé (XML)
├── error_data.json          ✅ Importé (JSON)
├── readme.txt               ✅ Importé
├── binary.exe               ❌ Filtré (executable)
└── image.jpg                ❌ Filtré (image)
```

**Résultat** : 5 fichiers importés sur 8

## 🔐 Sécurité

### Validations appliquées

- **MIME type** : application/vnd.rar, application/x-rar-compressed
- **Extension** : .rar seulement
- **Taille maximale** : Par défaut 1 GB (configurable)
- **Taille décompressée** : Limite contre les bombes ZIP
- **Traversée répertoires** : Chemins ../ rejetés
- **Fichiers sensibles** : .exe, .dll, .so filtrés

### Audit trail

Chaque import RAR est enregistré :

```sql
SELECT 
  user_id,
  filename,
  file_size,
  file_hash,
  import_source,
  status,
  processed_lines,
  error_count
FROM import_jobs
WHERE filename LIKE '%.rar'
ORDER BY created_at DESC;
```

## 📈 Performance

### Benchmarks (tests locaux)

| Taille | Fichiers | Temps | Mémoire |
|--------|----------|-------|---------|
| 10 MB  | 10       | ~500ms | 15 MB |
| 50 MB  | 50       | ~2.5s  | 50 MB |
| 100 MB | 100      | ~5s    | 100 MB |

### Optimisations appliquées

- **WASM** : Extraction native (plus rapide que CLI)
- **Memory Storage** : Multer en mémoire (pas de disque)
- **Batch Processing** : 500 logs par batch
- **Connection Pooling** : 10 connexions MySQL simultanées

## 📝 Configuration environnement

```bash
# .env

# Taille max de fichier (bytes)
UPLOAD_MAX_FILES=10
UPLOAD_MAX_SIZE=1073741824  # 1 GB

# Batch pour import
IMPORT_BATCH_SIZE=500

# Timeout extraction (cloud)
EXTRACT_TIMEOUT_MS=120000   # 2 min en Vercel/Render
```

## 🧪 Tests

### Créer une archive RAR de test

```bash
# Installation (macOS)
brew install rar

# Création
echo "[2024-01-15 10:30:45] ERROR Database connection failed" > test1.log
echo "[2024-01-15 10:31:00] INFO User login: admin" > test2.log

rar a test-archive.rar test*.log

# Vérification
unrar l test-archive.rar
unrar t test-archive.rar
```

### Import et vérification

```bash
# POST /api/import/upload
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-archive.rar" \
  -F "source=test-server" \
  -F "service=test-service" \
  http://localhost:3001/api/import/upload

# Résultat
{
  "job_id": "uuid-here",
  "filename": "test-archive.rar",
  "status": "completed",
  "processed_lines": 2,
  "error_count": 0
}
```

## 📞 Support

### Logs pertinents

```bash
# Tous les événements RAR
grep "\[ARCHIVE\]" logs/logsystem.log

# Extraction spécifique
grep "rar_extract" logs/logsystem.log

# Erreurs
grep "RAR_" logs/logsystem.log | grep -i error
```

### Commandes de diagnostic

```bash
# Script pour tester l'extraction RAR
node scripts/maintenance/test-rar-extraction.js

# Affiche les fichiers trouvés
node scripts/tools/analyze-archive.js archive.rar
```

## 🔗 Ressources

- [node-unrar-js](https://github.com/EvAlex/node-unrar-js)
- [7zip-bin](https://github.com/squeamish-ossifrage/7zip-bin)
- [RAR format](https://en.wikipedia.org/wiki/RAR_(file_format))
- [Magic bytes](https://en.wikipedia.org/wiki/List_of_file_signatures)

## 📋 Checklist de production

- ✅ node-unrar-js installé (npm list node-unrar-js)
- ✅ 7zip-bin disponible (npm list 7zip-bin)
- ✅ WASM chargé avec succès (logs de démarrage)
- ✅ Tests d'import RAR passants
- ✅ Limites de taille configurées
- ✅ Audit logging activé
- ✅ Alertes d'erreur configurées
- ✅ Backup de la base de données effectué
