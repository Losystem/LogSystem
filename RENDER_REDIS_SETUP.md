# Configuration Redis sur Render

## Problème
Le service Key Value Redis défini dans `render.yaml` n'est pas lié automatiquement au service web lors du déploiement initial. L'application fonctionne en mode dégradé sans cache.

## Solution Manuelle

### Étape 1 : Créer le service Redis Key Value
1. Aller sur [dashboard.render.com](https://dashboard.render.com)
2. "New +" → "Redis"
3. Nom : `logsystem-cache` (doit correspondre au nom dans `render.yaml`)
4. Région : même région que le service web
4. Plan : Free (25 Mo, suffisant pour le cache dashboard)

### Étape 2 : Lier le service Redis au service web
1. Ouvrir le service web LogSystem
2. "Settings" → "Environment"
3. Ajouter la variable d'environnement :
   - **Key** : `REDIS_URL`
   - **Value** : Laisser vide (sera automatiquement remplie par Render après liaison)
4. Scroller vers "Advanced" → "Dependent Services"
5. "Add Dependent Service" → Sélectionner `logsystem-cache`
6. Render ajoutera automatiquement `REDIS_URL` avec l'URL de connexion

### Étape 3 : Redéployer
1. "Manual Deploy" → "Deploy latest commit"
2. Vérifier les logs : le message `redis_not_configured` doit disparaître
3. Vérifier le message `redis_connected` dans les logs

## Vérification
Une fois configuré, les logs doivent montrer :
```
{"level":30,"event":"redis_connected","msg":"[CACHE] Redis connecté"}
```

Et non plus :
```
{"level":30,"event":"redis_not_configured","msg":"[CACHE] Redis non configuré — mode dégradé (cache désactivé)"}
```

## Alternative : Cache Mémoire (sans Redis)
Si Redis ne peut pas être configuré, l'application fonctionne en mode dégradé avec cache désactivé. Le benchmark a montré que les requêtes dashboard sans cache prennent ~6 secondes, donc Redis est recommandé pour une bonne UX.
