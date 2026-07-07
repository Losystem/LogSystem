# Render Deployment Verification Plan

## Overview
This document outlines the comprehensive verification steps for the LogSystem deployment on Render, focusing on the three critical areas identified in the audit follow-up.

## 1. RAR Extraction Verification

### Current Implementation Status
- **Package**: `node-unrar-js` v2.0.0 added to dependencies
- **Implementation**: ESM import with manual WASM binary loading
- **Location**: `lib/processing/archiveHandler.js` lines 26-67
- **Fix Applied**: Uses `import('node-unrar-js/esm')` and loads WASM binary manually via `fs.readFileSync()`
- **Fallback**: Multiple WASM path attempts for different environments

### Verification Steps

#### Step 1: Check Render Deployment Logs
- Access Render dashboard → LogSystem service → Logs
- Filter for `[ARCHIVE]` events
- Look for specific error patterns:
  - `TypeError: Failed to parse URL from .../unrar.wasm`
  - `unrar_load_failed`
  - `unrar_wasm_not_found`
- Document exact error message and stack trace

#### Step 2: Test RAR Extraction on Deployed Instance
1. Prepare a test `.rar` file containing log files
2. Upload via the import interface on deployed instance
3. Monitor logs for extraction events
4. Verify successful extraction and log import
5. Check for any errors in the import job status

#### Step 3: Fallback Plan (if current fix fails)
- **Alternative**: `libarchive.js` (supports RAR v4/v5, ZIP, TAR, GZ, 7z)
- **Rationale**: More actively maintained, single library for multiple formats
- **Implementation**: Replace `node-unrar-js` with `libarchive.js` in `archiveHandler.js`
- **Test**: Repeat Step 2 with new implementation

#### Step 4: Documentation Update (if RAR truly unsupported)
- Update REQ-005 to reflect actual platform limitations
- Provide clear error message to users: "RAR extraction not supported on this platform. Please use .zip or .7z format."
- Remove RAR from supported formats in UI

### Success Criteria
- Real `.rar` file successfully extracted on Render deployment
- Logs imported correctly from RAR archive
- No errors in deployment logs related to RAR extraction

---

## 2. Dashboard Cache Performance Decision

### Current Implementation
- **Cache Service**: `services/cacheService.js`
- **Backend**: Redis (optional, degrades gracefully if unavailable)
- **TTL**: 300 seconds (5 minutes) for dashboard stats
- **Invalidation**: On new import via `invalidateDashboard(userId)`

### Performance Measurement Steps

#### Step 1: Run Performance Measurement Script
```bash
node scripts/measure-dashboard-performance.js
```

This script measures:
- Summary endpoint queries (total logs, today counts, error counts, etc.)
- Trends endpoint queries (7-day trends)
- Top errors endpoint queries
- Recent logs endpoint queries
- Today stats endpoint queries

#### Step 2: Analyze Results
- **If max query time < 5 seconds**: Remove Redis, implement in-memory cache
- **If max query time ≥ 5 seconds**: Keep Redis, add to `render.yaml`

#### Step 3: Decision Implementation

**Option A: Remove Redis (if performance is good)**
- Remove Redis dependency from `package.json`
- Replace `services/cacheService.js` with simple Map-based cache:
  ```javascript
  const cache = new Map();
  const CACHE_TTL = 300000; // 5 minutes
  
  function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }
  
  function setCached(key, data) {
    cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL
    });
  }
  ```
- Remove Redis-related environment variables from documentation

**Option B: Keep Redis (if performance is poor)**
- Add Redis service to `render.yaml`:
  ```yaml
  services:
    - type: pserv
      name: redis
      plan: free
      envVars:
        - key: REDIS_URL
          fromService:
            type: redis
            name: redis
            property: connectionString
  ```
- Document `REDIS_URL` in required environment variables
- Note recurring cost in deployment documentation

### Success Criteria
- Performance measured with concrete numbers
- Decision justified by measured data
- Configuration matches performance needs
- Cost implications documented (if Redis kept)

---

## 3. Aiven Connection Keepalive Verification

### Current Configuration
- **Location**: `config/database.js` lines 97-105
- **Status**: Keepalive enabled on Render (unless `DB_KEEPALIVE=false`)
- **Interval**: Every 5 minutes (`5 * 60 * 1000` ms)
- **Query**: `SELECT 1`
- **Pool Settings**: `enableKeepAlive: true`, `keepAliveInitialDelay: 10000`

### Verification Steps

#### Step 1: 8+ Hour Inactivity Test
1. Deploy or use existing Render instance
2. Ensure no database activity for 8+ hours:
   - Disable any scheduled tasks
   - No user activity
   - No background jobs
3. Monitor application logs during this period
4. After 8+ hours, trigger a database query:
   - Access dashboard
   - Perform a search
   - Import a file
5. Check for `PROTOCOL_CONNECTION_LOST` errors

#### Step 2: Analyze Results

**If connection lost after 8h:**
- Confirm keepalive is actually running (check logs for `db_keepalive_failed` events)
- If keepalive not running: verify `DB_KEEPALIVE` environment variable
- If keepalive running but still failing: increase frequency (e.g., every 2 minutes)
- Document the exact failure point and fix applied

**If connection maintained after 8h:**
- Document that current configuration works
- Note that Aiven's 8h timeout may not be active on current tier
- Keep current configuration as-is

#### Step 3: Configuration Update (if needed)
If keepalive needs adjustment:
```javascript
// In config/database.js
const keepaliveInterval = process.env.DB_KEEPALIVE_INTERVAL 
  ? parseInt(process.env.DB_KEEPALIVE_INTERVAL, 10) 
  : 5 * 60 * 1000; // Default 5 minutes

setInterval(() => {
  pool.execute('SELECT 1').catch(err => {
    logger.warn({ event: 'db_keepalive_failed', error: err.message }, '[DB]');
  });
}, keepaliveInterval);
```

Add `DB_KEEPALIVE_INTERVAL` to environment variable documentation.

### Success Criteria
- Concrete evidence of connection behavior after 8h+ inactivity
- Logs showing keepalive activity (or lack thereof)
- Configuration justified by test results
- No `PROTOCOL_CONNECTION_LOST` errors in production

---

## 4. End-to-End Verification

### Test Sequence

#### 1. Authentication Flow
- [ ] Login with valid credentials
- [ ] Verify session persistence
- [ ] Test logout functionality
- [ ] Verify protected routes require authentication

#### 2. Import Flow (with RAR)
- [ ] Upload a real `.rar` file containing logs
- [ ] Monitor import job status
- [ ] Verify logs are extracted and imported
- [ ] Check import summary statistics
- [ ] Verify logs appear in search results

#### 3. Search Functionality
- [ ] Perform basic text search
- [ ] Test filters (log level, date range, source)
- [ ] Verify pagination works
- [ ] Check search performance

#### 4. Dashboard Verification
- [ ] Verify summary statistics display correctly
- [ ] Check trends visualization loads
- [ ] Verify top errors display
- [ ] Test per-level distribution chart
- [ ] Monitor dashboard load time

#### 5. Watch Log (SSE)
- [ ] Navigate to Watch Log page
- [ ] Verify SSE connection establishes
- [ ] Keep connection open for 5+ minutes
- [ ] Verify connection stays alive through Render proxy
- [ ] Test real-time log updates (if applicable)

#### 6. Administration
- [ ] Access admin interface
- [ ] Test user management (if available)
- [ ] Verify recommendation management interface
- [ ] Test system status checks

### Success Criteria
- All flows complete without errors
- SSE connection stable through Render proxy
- Dashboard loads within acceptable time
- RAR extraction works (or limitation documented)

---

## 5. Compliance Report Update

### Required Documentation

For each of the three critical areas, update the compliance report with:

#### RAR Extraction
- [ ] Actual error message from Render logs (or success confirmation)
- [ ] Test results with real `.rar` file
- [ ] If unsupported: Updated REQ-005 with accurate limitation
- [ ] If supported: Screenshot of successful import

#### Cache Decision
- [ ] Measured query times (all KPI endpoints)
- [ ] Average, min, max query times
- [ ] Decision made (Redis kept or removed)
- [ ] Justification based on measured data
- [ ] Cost implications (if Redis kept)

#### Keepalive Configuration
- [ ] Logs showing 8h+ inactivity test
- [ ] Evidence of connection behavior (lost or maintained)
- [ ] Current keepalive configuration
- [ ] Any adjustments made and why
- [ ] Timestamp of test

### Report Format
```
## RAR Extraction Support
**Status**: [SUPPORTED/LIMITED/UNSUPPORTED]
**Evidence**: [Link to logs/screenshots]
**Test Date**: [YYYY-MM-DD]
**Notes**: [Any additional context]

## Dashboard Cache
**Decision**: [REDIS KEPT/REDIS REMOVED]
**Measured Performance**:
- Average query time: Xms
- Max query time: Xms
- Total dashboard load: Xms
**Justification**: [Based on measured data]
**Cost Impact**: [If applicable]

## Database Keepalive
**Test Date**: [YYYY-MM-DD]
**Inactivity Period**: X hours
**Connection Status**: [MAINTAINED/LOST]
**Current Configuration**: [Details]
**Adjustments Made**: [If any]
```

---

## Execution Timeline

1. **Day 1**: Run performance measurement script, analyze results
2. **Day 2**: Check Render logs for RAR errors, test RAR extraction
3. **Day 3**: Execute 8h+ inactivity test (requires planning)
4. **Day 4**: Perform end-to-end verification
5. **Day 5**: Update compliance report with all findings

## Notes

- All tests must be performed on the deployed Render instance, not locally
- Logs should be captured and saved for evidence
- Screenshots should be taken for critical verification points
- Any deviations from this plan should be documented with rationale
