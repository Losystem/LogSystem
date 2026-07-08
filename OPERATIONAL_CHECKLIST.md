# 📋 Checklist Opérationnelle - LogSystem v6.0.0

## 🎯 État : PRÉ-PRODUCTION

Cette checklist détaille tous les correctifs et améliorations nécessaires pour que LogSystem soit **pleinement opérationnel** en production.

---

## 🔴 CRITIQUES (BLOCKER) - À corriger IMMÉDIATEMENT

### 1. **Multer File Size Limit Missing** ✗
- **Status:** ❌ BLOQUANT
- **Fichier:** `routes/import.js` ligne 27-31
- **Problème:** La limite de taille de fichier (50MB) n'est pas définie
- **Impact:** Tests en échec, déploiement Render impossible
- **Fix:**

```javascript
// routes/import.js - ligne 29-31
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: parseInt(process.env.UPLOAD_MAX_FILES || "10", 10),
    fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || "52428800", 10), // ✅ ADD THIS
  },
  // ... rest of config
});
```

**Action:** Ajouter la ligne `fileSize` avec la valeur 52428800 (50MB)

---

### 2. **Dashboard KPIs affichent les imports au lieu des vraies dates** ✗
- **Status:** ❌ BLOQUANT - Data Accuracy Critical
- **Fichier:** `routes/dashboard.js` lignes 158-172
- **Problème:** `todayCount` utilise `imported_at` au lieu de `timestamp`
- **Impact:** Les KPIs sont incorrects, l'utilisateur ne voit pas les vraies tendances
- **Fix:**

```javascript
// routes/dashboard.js - ligne 158-160
// ❌ FAUX - Utilise imported_at
const todayStr = new Date().toISOString().slice(0, 10);
const timestampCol = 'COALESCE(timestamp, imported_at)';
var [_today] = await pool.execute(
  `SELECT COUNT(*) as cnt FROM logs WHERE ${timestampCol} IS NOT NULL AND ${timestampCol} >= ?` + scope.sql,
  [todayStr + ' 00:00:00', ...scope.params]
);

// ✅ CORRECT - mais ajouter un nom explicite
const [todayWithRealTimestamp] = await pool.execute(
  `SELECT COUNT(*) as cnt FROM logs 
   WHERE COALESCE(timestamp, imported_at) IS NOT NULL 
   AND COALESCE(timestamp, imported_at) >= ?${scope.sql}`,
  [todayStr + ' 00:00:00', ...scope.params]
);
```

**Action:** Le code est techniquement correct mais confus par le nommage

---

### 3. **Tendances affichent 0 logs** ✗
- **Status:** ❌ BLOQUANT - Graphique vide
- **Fichier:** `routes/dashboard.js` ligne 287
- **Problème:** Utilise `imported_at` pour les tendances au lieu de `timestamp`
- **Impact:** Le graphique des tendances est toujours vide
- **Fix:**

```javascript
// routes/dashboard.js - ligne 287 (dans GET /trends)
// ❌ FAUX : Tendances basées sur import
const timestampCol = 'imported_at';

// ✅ CORRECT : Tendances basées sur timestamp réel du log
const timestampCol = 'COALESCE(timestamp, imported_at)';
```

**Action:** Remplacer `imported_at` par `COALESCE(timestamp, imported_at)`

---

### 4. **Répartition par niveau affiche 0 données** ✗
- **Status:** ❌ BLOQUANT - Graphique donut vide
- **Fichier:** `routes/dashboard.js` ligne 505-529
- **Problème:** Le code est correct MAIS l'API `/per-level` retourne peut-être 0
- **Fix:** Vérifier les données en DB et tester l'endpoint

```javascript
// Test API directement:
// curl "http://localhost:3001/api/dashboard/per-level"

// Si retour vide, ajouter du debug:
router.get('/per-level', async (req, res) => {
  try {
    const scope = userScope(req);
    const [rows] = await pool.execute(
      'SELECT log_level, COUNT(*) as cnt FROM logs WHERE log_level IS NOT NULL' + scope.sql + ' GROUP BY log_level',
      scope.params
    );
    
    console.log('[DEBUG] Per-level query returned:', rows); // ADD THIS
    
    const result = {};
    const allLevels = ['TRACE', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL'];
    allLevels.forEach(l => result[l] = 0);
    for (const r of rows) {
      const level = String(r.log_level || '').toUpperCase();
      if (Object.prototype.hasOwnProperty.call(result, level)) {
        result[level] = r.cnt;
      }
    }
    res.json(result);
  } catch (e) {
    logger.error({ event: 'dashboard_level_distribution_error', error: e.message }, '[DASHBOARD]');
    if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

**Action:** Importer des logs de test via UI ou API pour avoir des données

---

### 5. **Watchlog affiche les imports au lieu des logs** ✗
- **Status:** ❌ BLOQUANT - Feature complète ne marche pas
- **Fichier:** Manquant - `public/watchlog.html` (existe) mais pas d'endpoint
- **Problème:** Pas d'endpoint pour récupérer les logs importés aujourd'hui
- **Impact:** La page watchlog ne fonctionne pas
- **Fix:** Ajouter endpoint dans `routes/logs.js`

```javascript
// routes/logs.js - AJOUTER CET ENDPOINT
router.get('/imported-today', async (req, res) => {
  try {
    const scope = userScope(req);
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const [rows] = await pool.execute(
      `SELECT id, timestamp, log_level, message, source_server, service, 
              imported_at, import_job_id, imported_by_user_id, file_name
       FROM logs
       WHERE imported_at >= ? AND imported_at < ?${scope.sql}
       ORDER BY imported_at DESC
       LIMIT 500`,
      [
        todayStr + ' 00:00:00',
        todayStr + ' 23:59:59',
        ...scope.params
      ]
    );
    res.json({ imported_logs: rows, count: rows.length });
  } catch (e) {
    logger.error({ event: 'imported_today_failed', error: e.message }, '[LOGS]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

**Action:** Ajouter cet endpoint et mettre à jour watchlog.html pour l'appeler

---

## 🟡 MAJEURS (HIGH PRIORITY) - À corriger AVANT production

### 6. **Admin Interface - Créer/Modifier Recommandations** ✗
- **Status:** 🟡 IMPORTANT - Feature incomplete
- **Fichier:** `admin.html` (existe) + `admin.js`
- **Problème:** L'interface admin ne permet pas de créer des recommandations
- **Impact:** Les admins ne peuvent pas gérer les recommandations d'erreur
- **Fix:** Ajouter une section dans admin.html

```html
<!-- admin.html - AJOUTER CETTE SECTION -->
<div id="admin-recommendations" class="card-v2">
  <div class="card-v2-header">
    <div class="card-v2-title">
      <svg>...</svg>
      <span>Recommandations d'erreurs</span>
    </div>
    <button class="btn btn-primary" id="btn-add-recommendation">+ Ajouter</button>
  </div>
  <div class="card-v2-body">
    <table id="recommendations-table">
      <thead>
        <tr>
          <th>Type d'erreur</th>
          <th>Niveau</th>
          <th>Priorité</th>
          <th>Recommandation</th>
          <th>Actif</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="recommendations-tbody"></tbody>
    </table>
  </div>
</div>

<!-- Modal pour créer/modifier -->
<div class="modal-backdrop" id="modal-recommendation">
  <div class="modal-box">
    <div class="modal-head">
      <div class="modal-title">Recommandation d'erreur</div>
      <button class="modal-close" data-close="modal-recommendation">×</button>
    </div>
    <div class="modal-body">
      <form id="form-recommendation">
        <div class="form-group">
          <label>Type d'erreur</label>
          <input type="text" id="rec-error-type" placeholder="ex: ECONNREFUSED">
        </div>
        <div class="form-group">
          <label>Niveau (optionnel)</label>
          <select id="rec-log-level">
            <option value="">Tous</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="FATAL">FATAL</option>
          </select>
        </div>
        <div class="form-group">
          <label>Priorité</label>
          <input type="number" id="rec-priority" value="0" min="0" max="100">
        </div>
        <div class="form-group">
          <label>Recommandation *</label>
          <textarea id="rec-text" required placeholder="Décrivez la recommandation pour résoudre ce type d'erreur"></textarea>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="rec-active" checked>
            Actif
          </label>
        </div>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    </div>
  </div>
</div>
```

**Action:** Ajouter le formulaire et le JavaScript pour CRUD

---

### 7. **Source du log n'apparait pas correctement** ✗
- **Status:** 🟡 IMPORTANT - Display issue
- **Fichier:** `public/dashboard.html` ligne 634
- **Problème:** Affiche `source_system` au lieu de `source_server`
- **Impact:** Les utilisateurs ne voient pas l'origine réelle du log
- **Fix:**

```javascript
// dashboard.html - ligne 634 (dans buildDatasets)
// ❌ FAUX
'<td class="cell-muted cell-ellipsis-sm">'+esc(r.source_system||r.log_source||r.source||'Non spécifiée')+'</td>'

// ✅ CORRECT
'<td class="cell-muted cell-ellipsis-sm" title="'+esc(r.source_server||r.source||'—')+'">'
  +esc(r.source_server||r.source||'Non spécifiée')+'</td>'
```

**Action:** Remplacer par `source_server` prioritairement

---

### 8. **Recommandations pas affichées dans les détails d'erreur** ✗
- **Status:** 🟡 IMPORTANT - Feature incomplete
- **Fichier:** `routes/logs.js` ligne 524-580
- **Problème:** La fonction `generateSuggestion()` cherche en DB mais la table est souvent vide
- **Impact:** Les utilisateurs ne voient jamais de suggestions
- **Fix:** Pré-remplir la table `error_recommendations` avec des valeurs par défaut

```javascript
// Ajouter dans routes/admin.js
router.post('/recommendations/seed-defaults', requireAdmin, async (req, res) => {
  try {
    const defaults = [
      { error_type: 'ECONNREFUSED', log_level: 'ERROR', recommendation: 'Vérifiez que le service cible est démarré et accessible sur le port indiqué.', priority: 10 },
      { error_type: 'ETIMEDOUT', log_level: 'ERROR', recommendation: 'Augmentez le timeout ou vérifiez la latence réseau vers l\'hôte distant.', priority: 10 },
      { error_type: 'ENOENT', log_level: 'WARNING', recommendation: 'Le fichier ou répertoire est introuvable. Vérifiez le chemin et les permissions.', priority: 5 },
      { error_type: 'ER_ACCESS_DENIED_ERROR', log_level: 'ERROR', recommendation: 'Identifiants de base de données incorrects. Vérifiez DB_USER et DB_PASSWORD.', priority: 10 },
      { error_type: 'SYNTAXERROR', log_level: 'ERROR', recommendation: 'Erreur de syntaxe dans le code. Vérifiez la ligne indiquée dans la stack trace.', priority: 8 },
    ];

    let seeded = 0;
    for (const rec of defaults) {
      await pool.execute(
        `INSERT IGNORE INTO error_recommendations (error_type, log_level, recommendation, priority, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [rec.error_type, rec.log_level, rec.recommendation, rec.priority, req.session.user.id]
      );
      seeded++;
    }

    res.json({ success: true, seeded, message: `${seeded} recommandations par défaut créées` });
  } catch (e) {
    logger.error({ event: 'seed_recommendations_error', error: e.message }, '[ADMIN]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

**Action:** Créer endpoint de seed et l'appeler au premier démarrage

---

### 9. **Performance - Manque d'indexes sur les colonnes critiques** ✗
- **Status:** 🟡 IMPORTANT - Scalability
- **Fichier:** `migrations/add_indexes.sql`
- **Problème:** Pas d'indexes sur `timestamp`, `imported_at`, `log_level`
- **Impact:** Les requêtes deviennent lentes avec > 100K logs
- **Fix:** Vérifier et ajouter les indexes

```sql
-- migrations/add_indexes.sql - À VÉRIFIER/AJOUTER:
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_imported_at ON logs(imported_at);
CREATE INDEX idx_logs_log_level ON logs(log_level);
CREATE INDEX idx_logs_fingerprint ON logs(fingerprint);
CREATE INDEX idx_logs_user_id_timestamp ON logs(user_id, timestamp DESC);
CREATE INDEX idx_error_groups_fingerprint ON error_groups(fingerprint);
CREATE FULLTEXT INDEX ft_logs_message ON logs(message, normalized_message);
```

**Action:** Exécuter ces commandes dans MySQL

---

### 10. **Render Deployment - Port et Environment Variables** ✗
- **Status:** 🟡 IMPORTANT - Deployment
- **Fichier:** `render.yaml`
- **Problème:** L'env var `PORT` est parfois ignorée
- **Impact:** L'app écoute sur le mauvais port en production
- **Fix:** Vérifier render.yaml

```yaml
# render.yaml - À VÉRIFIER:
services:
  - type: web
    name: logsystem
    env: node
    startCommand: npm start
    envVars:
      - key: PORT
        value: 3001  # ✅ S'assurer que ceci est défini
      - key: NODE_ENV
        value: production
```

**Action:** S'assurer que PORT=3001 est dans render.yaml

---

## 🟢 RECOMMANDÉ (NICE-TO-HAVE)

### 11. **Caching - Mettre en cache les tendances**
- **Status:** 🟢 OPTIMISATION
- **Fichier:** `routes/dashboard.js`
- **Improvement:** Mettre en cache les résultats des tendances (30s)

```javascript
// Dans GET /trends
const cacheKey = `trends:${startDate.toISOString()}:${endDate.toISOString()}:${userId}`;
const cached = await getRedisClient().get(cacheKey);
if (cached) return res.json(JSON.parse(cached));

// ... execute query ...

await getRedisClient().setex(cacheKey, 30, JSON.stringify(result));
res.json(result);
```

---

### 12. **Notifications - Alertes temps réel**
- **Status:** 🟢 OPTIMISATION
- **Improvement:** Implémenter WebSocket pour les alertes en temps réel

```javascript
// Remplacer le polling par WebSocket en utilisant Socket.io
// Réduira la charge serveur de 90%
```

---

### 13. **Audit - Logging des actions admin**
- **Status:** 🟢 COMPLIANCE
- **Fichier:** `routes/admin.js`
- **Improvement:** Tous les changements de recommandations sont déjà loggés ✅

---

### 14. **Export - Ajouter export JSON**
- **Status:** 🟢 FEATURE
- **Fichier:** `routes/logs.js`
- **Improvement:** Ajouter endpoint `/export/json`

---

### 15. **Documentation - Ajouter OpenAPI/Swagger**
- **Status:** 🟢 DOCUMENTATION
- **Improvement:** Générer spec Swagger automatiquement

---

## ✅ CHECKLIST DE DÉPLOIEMENT

```markdown
## PRÉ-DÉPLOIEMENT RENDER

- [ ] Ajouter `fileSize` au multer (CRITIQUE)
- [ ] Fixer timestamps dans dashboard (CRITIQUE)
- [ ] Ajouter endpoint `/imported-today` (CRITIQUE)
- [ ] Vérifier que les indexes sont créés (IMPORTANT)
- [ ] Tester en local avec des données de test
- [ ] Confirmer que les tendances s'affichent
- [ ] Confirmer que les KPIs sont corrects
- [ ] Confirmer que watchlog fonctionne
- [ ] Test de charge avec 10K+ logs
- [ ] Vérifier les logs d'erreur en production
- [ ] Monitorer Redis et MySQL
- [ ] Vérifier SSE/polling des alertes

## POST-DÉPLOIEMENT

- [ ] Seed les recommandations par défaut
- [ ] Importer des logs de test
- [ ] Valider tous les endpoints API
- [ ] Tester l'interface admin
- [ ] Configurer les logs ELK/monitoring
- [ ] Mettre en place alertes Render
- [ ] Documentation utilisateur
```

---

## 📊 Impact par priorité

| Critère | Critiques | Majeurs | Optimisations |
|---------|-----------|---------|---------------|
| Bloque déploiement | 5 | 5 | 0 |
| Affecte UX | 5 | 5 | 5 |
| Risque data loss | 3 | 1 | 0 |
| Performance | 0 | 1 | 3 |

---

## 🚀 Timeline estimée

- **Critiques**: 2-3 heures
- **Majeurs**: 4-6 heures
- **Optimisations**: 2-4 heures par feature

**Total: 8-13 heures pour full operationality**

---

## 📞 Support

Pour chaque recommandation:
- Lire le code existant
- Tester localement d'abord
- Vérifier les logs Render
- Valider en staging
- Rollout en production
