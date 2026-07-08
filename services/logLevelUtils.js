/**
 * Utility functions for normalizing and comparing log levels.
 * Moved from config/database.js for better separation of concerns.
 */

export function normalizeLevel(level) {
  const l = String(level || 'INFO').toUpperCase();
  
  // Pino numeric level mapping: 10→TRACE, 20→DEBUG, 30→INFO, 40→WARN, 50→ERROR, 60→FATAL
  const numericMap = {
    '10': 'TRACE',
    '20': 'DEBUG',
    '30': 'INFO',
    '40': 'WARNING',
    '50': 'ERROR',
    '60': 'CRITICAL'
  };
  
  if (numericMap[l]) {
    return numericMap[l];
  }
  
  const valid = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL', 'SECURITY', 'TRACE'];
  return valid.includes(l) ? l : 'INFO';
}

export function levelSeverity(level) {
  const map = {
    'TRACE': 0,
    'DEBUG': 1,
    'INFO': 2,
    'WARNING': 3,
    'ERROR': 4,
    'CRITICAL': 5,
    'FATAL': 6,
    'SECURITY': 7
  };
  return map[normalizeLevel(level)] || 0;
}

export default { normalizeLevel, levelSeverity };