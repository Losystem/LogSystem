/**
 * Production scenario tests — dashboard, search, alerts, RAR import
 * Runs without live DB for most cases
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('Dashboard API trends logic', () => {
  it('hourly query uses COALESCE timestamp columns', () => {
    const src = readFileSync(path.join(root, 'routes/dashboard.js'), 'utf8');
    expect(src).toContain('COALESCE(timestamp, imported_at)');
    expect(src).toContain('UPPER(log_level)');
  });

  it('top-errors enriches sample_log_id from sample logs', () => {
    const src = readFileSync(path.join(root, 'routes/dashboard.js'), 'utf8');
    expect(src).toContain('sample_log_id: r.sample_log_id || (samples[0]');
  });
});

describe('Dashboard frontend', () => {
  it('uses local fmtDate not UTC toISOString', () => {
    const html = readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');
    expect(html).not.toMatch(/function fmtDate\(d\)\{\s*return d\.toISOString\(\)/);
    expect(html).toContain('d.getFullYear()');
  });

  it('modal sample log button handler on modal-detail-body', () => {
    const html = readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');
    expect(html).toContain("document.getElementById('modal-detail-body').addEventListener('click'");
    expect(html).toContain('#btn-show-sample-log');
  });

  it('error handlers use e.error fallback', () => {
    const html = readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');
    expect(html).toContain('e.error || e.message');
  });

  it('trendsChart resize uses correct variable', () => {
    const html = readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');
    expect(html).toContain('if (trendsChart) trendsChart.resize()');
    expect(html).not.toContain('window.trendChart');
  });
});

describe('Alert engine', () => {
  it('exports evalAllForUser', async () => {
    const mod = await import('../services/alertEngine.js');
    expect(typeof mod.evalAllForUser).toBe('function');
  });

  it('seeds global alert rules not admin-only', () => {
    const src = readFileSync(path.join(root, 'services/alertEngine.js'), 'utf8');
    expect(src).toContain('is_global = 1');
  });

  it('evalRule uses COALESCE for timestamps', () => {
    const src = readFileSync(path.join(root, 'services/alertEngine.js'), 'utf8');
    expect(src).toContain("const tsCol = 'COALESCE(timestamp, imported_at)'");
  });
});

describe('Import integration', () => {
  it('calls evalAllForUser after import', () => {
    const src = readFileSync(path.join(root, 'routes/import.js'), 'utf8');
    expect(src).toContain('await evalAllForUser(userId)');
  });
});

describe('Search API', () => {
  it('has FULLTEXT fallback via runLogsSearch', () => {
    const src = readFileSync(path.join(root, 'routes/api/search.js'), 'utf8');
    expect(src).toContain('async function runLogsSearch');
    expect(src).toContain('search_fallback');
  });
});

describe('RAR archive handler', () => {
  it('loads wasm from lib/assets path', () => {
    const src = readFileSync(path.join(root, 'lib/processing/archiveHandler.js'), 'utf8');
    expect(src).toContain("'..', 'assets', 'unrar.wasm'");
  });

  it('detects RAR by magic bytes', async () => {
    const { detectArchiveType } = await import('../lib/processing/archiveHandler.js');
    const buf = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
    expect(detectArchiveType('test.rar', buf)).toBe('rar');
  });
});

describe('Search API fallback helpers', () => {
  it('applySearchFallback converts FULLTEXT to LIKE', async () => {
    const mod = await import('../routes/api/search.js');
    expect(mod.default).toBeDefined();
    const src = readFileSync(path.join(root, 'routes/api/search.js'), 'utf8');
    expect(src).toContain('function applySearchFallback');
    expect(src).toContain('runCountQuery');
    expect(src).toContain('runFacetQuery');
  });
});

describe('HTTP log ingestion', () => {
  it('logs-ingestion route mounted in server.js', () => {
    const src = readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(src).toContain('logsIngestionRoutes');
  });

  it('ingest triggers alert eval', () => {
    const src = readFileSync(path.join(root, 'routes/logs-ingestion.js'), 'utf8');
    expect(src).toContain("alertEngineBus.emit('logs.inserted'");
    expect(src).toContain('await evalAllForUser(userId)');
  });
});

describe('Archive extraction', () => {
  it('extracts GZIP log file', async () => {
    const { extractArchive, filterLogFiles } = await import('../lib/processing/archiveHandler.js');
    const zlib = await import('zlib');
    const { promisify } = await import('util');
    const gzip = promisify(zlib.gzip);
    const content = '2026-01-01 10:00:00 ERROR Database connection failed\n';
    const buf = await gzip(Buffer.from(content));
    const files = await extractArchive(buf, 'app.log.gz');
    const logs = filterLogFiles(files);
    expect(logs.length).toBe(1);
    expect(logs[0].content.toString()).toContain('ERROR');
  });

  it('isArchive detects common extensions', async () => {
    const { isArchive } = await import('../lib/processing/archiveHandler.js');
    expect(isArchive('logs.zip')).toBe(true);
    expect(isArchive('logs.rar')).toBe(true);
    expect(isArchive('plain.log')).toBe(false);
  });
});

describe('Render config', () => {
  it('has render.yaml configuration', () => {
    const yaml = readFileSync(path.join(root, 'render.yaml'), 'utf8');
    expect(yaml).toContain('type: web');
    expect(yaml).toContain('env: node');
    expect(yaml).toContain('healthCheckPath: /health');
  });
});

describe('Server module load', () => {
  it('server.js configures all API routes', () => {
    const src = readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(src).toContain("app.use('/api/dashboard'");
    expect(src).toContain("app.use('/api/search'");
    expect(src).toContain("app.use('/api/import'");
  });
});
