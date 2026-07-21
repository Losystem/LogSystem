import pool from '../config/database.js';
import logger from '../config/logger.js';

const DEFAULT_RECOMMENDATIONS = [
  ['ECONNREFUSED', 'Connexion refusée — Vérifiez que le service cible est démarré, accessible et autorisé par le pare-feu.', 10],
  ['ETIMEDOUT', 'Timeout réseau — Contrôlez la latence, les règles firewall et augmentez les timeouts si nécessaire.', 5],
  ['ER_ACCESS_DENIED_ERROR', 'Accès base de données refusé — Vérifiez identifiants, rôles et privilèges MySQL.', 10],
  ['ER_NO_SUCH_TABLE', 'Table absente — Exécutez les migrations et vérifiez que le schéma est à jour.', 10],
  ['HTTP 500', 'Erreur serveur interne — Consultez les stack traces applicatives et la configuration serveur.', 10],
  ['HTTP 503', 'Service indisponible — Vérifiez charge, redémarrages et capacité Render/base de données.', 10],
  ['HTTP 404', 'Ressource introuvable — Contrôlez routes, URLs et paramètres de requête.', 5],
  ['TypeError', 'Type incompatible — Validez les structures de données et réponses API.', 5],
  ['ReferenceError', 'Variable non définie — Vérifiez imports, déclarations et portée des variables.', 5],
  ['ENOENT', 'Fichier introuvable — Contrôlez chemins, montages volumes et permissions Render.', 5],
  ['ENOMEM', 'Mémoire insuffisante — Surveillez l\'usage mémoire et optimisez les traitements lourds.', 10],
  ['Connection lost', 'Connexion base perdue — Vérifiez pool MySQL, SSL et stabilité réseau Render ↔ Aiven.', 10],
  ['Authentication failed', 'Échec authentification — Contrôlez tokens, mots de passe et comptes utilisateurs.', 10],
  ['Validation failed', 'Validation échouée — Vérifiez formats, champs obligatoires et règles métier.', 5],
];

export async function ensureDefaultRecommendations() {
  try {
    const [tables] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'error_recommendations'`
    );
    if (!tables[0]?.cnt) return;

    const [existing] = await pool.execute('SELECT COUNT(*) AS cnt FROM error_recommendations WHERE is_active = 1');
    if (existing[0]?.cnt > 0) return;

    const [adminUsers] = await pool.execute(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id ASC LIMIT 1"
    );
    const creatorId = adminUsers[0]?.id;
    if (!creatorId) {
      logger.info({ event: 'recommendations_seed_skipped', reason: 'no_admin' }, '[RECOMMENDATIONS]');
      return;
    }

    for (const [errorType, recommendation, priority] of DEFAULT_RECOMMENDATIONS) {
      await pool.execute(
        `INSERT INTO error_recommendations (error_type, recommendation, priority, is_active, created_by)
         SELECT ?, ?, ?, 1, ?
         WHERE NOT EXISTS (SELECT 1 FROM error_recommendations WHERE error_type = ? AND is_active = 1)`,
        [errorType, recommendation, priority, creatorId, errorType]
      );
    }

    logger.info({ event: 'default_recommendations_seeded', count: DEFAULT_RECOMMENDATIONS.length }, '[RECOMMENDATIONS]');
  } catch (e) {
    logger.error({ event: 'recommendations_seed_error', error: e.message }, '[RECOMMENDATIONS]');
  }
}
