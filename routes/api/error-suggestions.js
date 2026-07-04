/**
 * Error Suggestions API
 * Provides AI-powered error analysis and solution recommendations
 */

import express from 'express';
import { analyzeErrorGroup, detectRecurringPatterns, suggestFix, getErrorInfo } from '../../services/errorAnalyzer.js';

const router = express.Router();

/**
 * GET /api/error-suggestions/fix
 * Get a suggested fix for a specific error
 */
router.get('/fix', async (req, res) => {
  try {
    const { error_type, message } = req.query;
    
    if (!error_type && !message) {
      return res.status(400).json({ error: 'error_type or message parameter required' });
    }
    
    const suggestion = suggestFix(error_type, message, null);
    const info = getErrorInfo(error_type, message);
    
    res.json({
      suggestion,
      error_info: info
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/error-suggestions/analyze/:fingerprint
 * Analyze an error group by fingerprint
 */
router.get('/analyze/:fingerprint', async (req, res) => {
  try {
    const { fingerprint } = req.params;
    const userId = req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const analysis = await analyzeErrorGroup(fingerprint, userId);
    
    if (!analysis) {
      return res.status(404).json({ error: 'Error group not found' });
    }
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/error-suggestions/patterns
 * Detect recurring error patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const windowHours = parseInt(req.query.window_hours || '24', 10);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const patterns = await detectRecurringPatterns(userId, windowHours);
    
    res.json({
      patterns,
      count: patterns.length,
      window_hours: windowHours
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
