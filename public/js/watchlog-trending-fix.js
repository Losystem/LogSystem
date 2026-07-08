/**
 * WatchLog Trending & Distribution Fix
 * Fixe les problèmes d'affichage des tendances et de la répartition par niveau
 */

const TrendingFix = (() => {
  const LEVEL_COLORS = {
    DEBUG: '#6366f1',
    INFO: '#0ea5e9',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    CRITICAL: '#7c3aed',
    FATAL: '#991b1b'
  };

  /**
   * Affiche les tendances par heure (24h)
   */
  function loadHourlyTrends() {
    api.get('/api/logs/trending-by-hour')
      .then(data => {
        if (!data.trends || data.trends.length === 0) {
          updateTrendsTable([]);
          return;
        }

        // Remplir les heures manquantes avec des zéros
        const fullTrends = new Array(24).fill(null).map((_, hour) => {
          const found = data.trends.find(t => t.hour === hour);
          return found || {
            hour,
            total: 0,
            errors: 0,
            critical: 0,
            fatal: 0
          };
        });

        updateTrendsTable(fullTrends);
      })
      .catch(err => console.warn('[Trends] Load error:', err));
  }

  /**
   * Met à jour le tableau des tendances
   */
  function updateTrendsTable(trends) {
    const container = document.getElementById('hourly-trends-table');
    if (!container) return;

    if (trends.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune donnée</p>';
      return;
    }

    let html = `
      <table class="trends-table">
        <thead>
          <tr>
            <th>Heure</th>
            <th>Total</th>
            <th>Erreurs</th>
            <th>Critiques</th>
            <th>Fatals</th>
          </tr>
        </thead>
        <tbody>
    `;

    trends.forEach(trend => {
      const hour = String(trend.hour).padStart(2, '0');
      const total = trend.total || 0;
      const errors = trend.errors || 0;
      const critical = trend.critical || 0;
      const fatal = trend.fatal || 0;

      html += `
        <tr class="trend-row" data-hour="${trend.hour}">
          <td class="hour-cell">${hour}:00</td>
          <td class="total-cell">${total.toLocaleString('fr-FR')}</td>
          <td class="error-cell">${errors}</td>
          <td class="critical-cell" style="color: #7c3aed">${critical}</td>
          <td class="fatal-cell" style="color: #991b1b">${fatal}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
    updateTrendsTime();
  }

  /**
   * Affiche la répartition par niveau
   */
  function loadLevelDistribution() {
    api.get('/api/logs/level-distribution')
      .then(data => {
        if (!data.distribution || data.distribution.length === 0) {
          updateLevelChart([]);
          return;
        }

        updateLevelChart(data.distribution);
      })
      .catch(err => console.warn('[Distribution] Load error:', err));
  }

  /**
   * Met à jour le graphique de répartition
   */
  function updateLevelChart(distribution) {
    const container = document.getElementById('levelChart');
    if (!container) return;

    if (distribution.length === 0) {
      container.innerHTML = '<p class="no-data">Aucune donnée</p>';
      return;
    }

    let html = '<div class="level-distribution">';

    distribution.forEach(item => {
      const level = item.level || 'UNKNOWN';
      const count = item.count || 0;
      const percentage = item.percentage || 0;
      const color = LEVEL_COLORS[level] || '#999';

      html += `
        <div class="level-item">
          <div class="level-header">
            <span class="level-name" style="color: ${color}">${level}</span>
            <span class="level-count">${count.toLocaleString('fr-FR')}</span>
          </div>
          <div class="level-bar">
            <div class="level-fill" style="width: ${percentage}%; background: ${color};"></div>
          </div>
          <span class="level-percentage">${percentage}%</span>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Met à jour l'heure de mise à jour
   */
  function updateTrendsTime() {
    const timeEl = document.getElementById('trends-update-time');
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `(mis à jour ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')})`;
    }
  }

  return {
    init() {
      loadHourlyTrends();
      loadLevelDistribution();

      // Mise à jour automatique
      setInterval(() => {
        loadHourlyTrends();
        loadLevelDistribution();
      }, 15000); // 15 secondes
    }
  };
})();

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TrendingFix.init());
} else {
  TrendingFix.init();
}
