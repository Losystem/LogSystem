import { Router } from "express";
import logger from "../config/logger.js";
import pool from "../config/database.js";
import { requireAuth, userScope } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/logs/watch/stats
 * Statistiques en temps réel pour watchlog
 */
router.get('/watch/stats', async (req, res) => {
  try {
    const scope = userScope(req);
    const userIdClause = scope.sql;
    const userIdParams = scope.params;

    // Logs des dernières 24h
    const [logs] = await pool.execute(
      `SELECT 
        COUNT(*) as total_logs,
        SUM(CASE WHEN log_level IN ('ERROR','CRITICAL','FATAL') THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN log_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN log_level = 'FATAL' THEN 1 ELSE 0 END) as fatal_count,
        COUNT(DISTINCT service) as services
       FROM logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ${userIdClause}`,
      userIdParams
    );

    // Logs/minute (dernières 5 minutes)
    const [logsPerMin] = await pool.execute(
      `SELECT COUNT(*) / 5.0 as logs_per_min
       FROM logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       ${userIdClause}`,
      userIdParams
    );

    res.json({
      stats: {
        total_logs: logs[0]?.total_logs || 0,
        error_count: logs[0]?.error_count || 0,
        critical_count: logs[0]?.critical_count || 0,
        fatal_count: logs[0]?.fatal_count || 0,
        services: logs[0]?.services || 0,
        logs_per_min: Math.round(logsPerMin[0]?.logs_per_min || 0)
      }
    });
  } catch (e) {
    logger.error({ event: 'watchlog_stats_error', error: e.message }, '[WATCHLOG]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/logs/trending-by-hour
 * Tendances par heure (24h) - FIX pour watchlog
 */
router.get('/trending-by-hour', async (req, res) => {
  try {
    const scope = userScope(req);
    const userIdClause = scope.sql;
    const userIdParams = scope.params;

    // Récupérer les stats par heure
    const [trends] = await pool.execute(
      `SELECT 
        HOUR(timestamp) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN log_level IN ('ERROR','CRITICAL','FATAL') THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN log_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN log_level = 'FATAL' THEN 1 ELSE 0 END) as fatal
       FROM logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ${userIdClause}
       GROUP BY HOUR(timestamp)
       ORDER BY hour ASC`,
      userIdParams
    );

    res.json({ trends });
  } catch (e) {
    logger.error({ event: 'trending_error', error: e.message }, '[LOGS]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/logs/level-distribution
 * Répartition par niveau de log - FIX pour watchlog
 */
router.get('/level-distribution', async (req, res) => {
  try {
    const scope = userScope(req);
    const userIdClause = scope.sql;
    const userIdParams = scope.params;

    const [distribution] = await pool.execute(
      `SELECT 
        log_level as level,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM logs WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ${userIdClause}), 2) as percentage
       FROM logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ${userIdClause}
       GROUP BY log_level
       ORDER BY FIELD(log_level, 'FATAL', 'CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG')`,
      [...userIdParams, ...userIdParams]
    );

    res.json({ distribution });
  } catch (e) {
    logger.error({ event: 'distribution_error', error: e.message }, '[LOGS]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/logs/imported-today
 * Logs importés aujourd'hui (pour watchlog)
 */
router.get('/imported-today', async (req, res) => {
  try {
    const scope = userScope(req);
    const today = new Date().toISOString().slice(0, 10);
    const limit = Math.min(parseInt(req.query.limit || 100), 500);
    
    const [rows] = await pool.execute(
      `SELECT 
        id,
        timestamp,
        log_level,
        message,
        source_server,
        source,
        service,
        imported_at,
        import_job_id,
        file_name
       FROM logs
       WHERE imported_at >= ? AND imported_at < ?${scope.sql}
       ORDER BY imported_at DESC
       LIMIT ?`,
      [today + ' 00:00:00', today + ' 23:59:59', ...scope.params, limit]
    );
    
    res.json({ imported_logs: rows });
  } catch (e) {
    logger.error({ event: 'imported_today_error', error: e.message }, '[IMPORT]');
    if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/logs/import-jobs/:jobId/live
 * Suivi en temps réel d'un job d'import (pour watchlog)
 */
router.get('/import-jobs/:jobId/live', async (req, res) => {
  try {
    const scope = userScope(req);
    const jobId = req.params.jobId;

    // Vérifier que le job appartient à l'utilisateur
    const [job] = await pool.execute(
      `SELECT 
        id, filename, status, total_lines, processed_lines,
        error_count, created_at, completed_at, import_summary
       FROM import_jobs
       WHERE id = ? AND user_id = ?`,
      [jobId, req.session.user.id]
    );

    if (job.length === 0) {
      return res.status(404).json({ error: 'Job non trouvé' });
    }

    const jobData = job[0];
    const total = jobData.total_lines || 0;
    const processed = jobData.processed_lines || 0;
    const errors = jobData.error_count || 0;

    // Logs importés par ce job
    const [logs] = await pool.execute(
      `SELECT 
        id, timestamp, log_level, message, service,
        source_server, file_name
       FROM logs
       WHERE import_job_id = ?
       ORDER BY timestamp DESC
       LIMIT 100`,
      [jobId]
    );

    res.json({
      job: {
        id: jobData.id,
        filename: jobData.filename,
        status: jobData.status,
        progress: total > 0 ? Math.round((processed / total) * 100) : 0,
        total_lines: total,
        processed_lines: processed,
        error_count: errors,
        created_at: jobData.created_at,
        completed_at: jobData.completed_at,
        summary: jobData.import_summary ? JSON.parse(jobData.import_summary) : null
      },
      recent_logs: logs
    });
  } catch (e) {
    logger.error({ event: 'import_job_live_error', error: e.message }, '[IMPORT]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/logs/recent-imports
 * Imports récents pour affichage dans watchlog
 */
router.get('/recent-imports', async (req, res) => {
  try {
    const scope = userScope(req);
    const limit = Math.min(parseInt(req.query.limit || 20), 100);

    const [imports] = await pool.execute(
      `SELECT 
        id, filename, status, total_lines, processed_lines,
        error_count, created_at, completed_at
       FROM import_jobs
       WHERE user_id = ?${scope.sql}
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.session.user.id, ...scope.params, limit]
    );

    res.json({ imports });
  } catch (e) {
    logger.error({ event: 'recent_imports_error', error: e.message }, '[IMPORT]');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
