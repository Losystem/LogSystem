# Configuration Redis pour LogSystem sur Render

## Problème actuel

Redis n'est pas configuré, ce qui force l'application à fonctionner en mode dégradé sans cache. Cela augmente la charge sur la base de données et peut provoquer des timeouts.

## Solution : Ajouter Redis sur Render

### Option 1 : Render Redis (recommandé)

1. **Créer un service Redis sur Render**
   - Allez dans votre dashboard Render
   - Cliquez sur "New +" → "Redis"
   - Nommez-le `logsystem-redis`
   - Sélectionnez le même région que votre service web
   - Créez le service

2. **Connecter Redis à votre service web**
   - Allez dans votre service web LogSystem
   - Cliquez sur "Environment"
   - Scrollez vers "Redis" section
   - Sélectionnez `logsystem-redis` dans la liste
   - Render ajoutera automatiquement les variables d'environnement

3. **Variables d'environnement ajoutées automatiquement**
   Render va ajouter :
   - `REDIS_URL` (format: `redis://default:password@host:port`)
   - `REDIS_PASSWORD`
   - `REDIS_HOST`
   - `REDIS_PORT`

4. **Redéployer le service**
   - Les changements d'environnement déclenchent un redéploiement automatique
   - Vérifiez les logs pour confirmer : `[CACHE] Redis connected` au lieu de `redis_not_configured`

### Option 2 : Aiven Redis (alternative)

1. **Créer un service Redis sur Aiven**
   - Allez dans votre console Aiven
   - Cliquez "Create service" → "Redis"
   - Sélectionnez le plan adapté (free/standalone)
   - Créez le service

2. **Obtenir les informations de connexion**
   - Dans le service Aiven Redis
   - Onglet "Overview" → "Connection Information"
   - Copiez l'URI de connexion

3. **Configurer les variables d'environnement sur Render**
   Dans votre service web Render → Environment :
   ```
   REDIS_URL=redis://user:password@aiven-host:port
   REDIS_PASSWORD=votre_password
   REDIS_HOST=aiven-host
   REDIS_PORT=port
   ```

4. **Redéployer le service**

### Option 3 : Upstash Redis (alternative gratuite)

1. **Créer un compte Upstash**
   - Allez sur https://upstash.com/
   - Créez un compte gratuit

2. **Créer une base Redis**
   - Dashboard → "Create Database"
   - Sélectionnez la région proche de Render
   - Créez la base

3. **Obtenir l'URL de connexion**
   - Dans la base Upstash → "Details" → "REST API" ou "Redis"
   - Copiez l'URL

4. **Configurer sur Render**
   ```
   REDIS_URL=rediss://default:password@host:port
   ```

## Vérification de la configuration

Après redéploiement, vérifiez les logs Render :

```
✅ Succès : [CACHE] Redis connected
❌ Échec : [CACHE] Redis non configuré — mode dégradé
```

Vous pouvez aussi tester via l'API :

```bash
curl https://logsystem-w2cr.onrender.com/api/dashboard/system
```

La réponse devrait inclure :
```json
{
  "system": {
    "redis": "ok",
    ...
  }
}
```

## Bénéfices de Redis activé

- **Performance** : Cache du dashboard (5 minutes TTL) réduit la charge DB
- **Réactivité** : Réponses plus rapides pour les agrégations
- **Stabilité** : Moins de timeouts sur les requêtes lourdes
- **Scalabilité** : Meilleure gestion des pics de trafic

## Dépannage

### Redis ne se connecte pas

1. Vérifiez que les variables d'environnement sont présentes
2. Vérifiez que le service Redis est dans la même région
3. Vérifiez les logs Render pour les erreurs de connexion
4. Testez la connexion localement avec `redis-cli`

### Erreur "Redis connection refused"

- Vérifiez que le service Redis est démarré
- Vérifiez les credentials (password/host/port)
- Vérifiez les règles de pare-feu (Render ↔ Redis)

### Mode dégradé persistant

- Le code fonctionne en mode dégradé si Redis n'est pas disponible
- Ce n'est pas bloquant, mais moins performant
- Priorité moyenne pour la stabilité globale
