# Archive Troubleshooting Guide

## Quick Diagnosis

### Enable Debug Logging

```bash
# Set log level to debug
export LOG_LEVEL=debug
npm start

# Watch for archive events
grep -i "archive\|rar\|extract" logs/logsystem.log
```

## Common Issues & Solutions

### 1. "Archive extraction not available on this platform"

**Problem**: RAR extraction fails silently

**Root Cause**:
- node-unrar-js WASM binary not found
- Platform incompatibility (rare)
- Memory issue during WASM load

**Diagnosis**:

```bash
# Check WASM file
find node_modules -name "unrar.wasm" -type f

# Check logs
grep "unrar_wasm" logs/logsystem.log
```

**Fix**:

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Verify WASM loaded
npm start 2>&1 | grep -i wasm
```

### 2. "File too large (max 1 GB decompressed)"

**Problem**: Large archives rejected during extraction

**Root Cause**: Compressed size bomb or legitimate large file

**Solution**:

- Split into smaller archives
- Increase limit (if justified):

```javascript
// In archiveHandler.js
const maxExtractSize = 5 * 1024 * 1024 * 1024; // 5 GB
```

### 3. "Archive corrupted or invalid"

**Problem**: Valid-looking RAR file fails to extract

**Diagnosis**:

```bash
# Test with unrar CLI
unrar t archive.rar

# Extract manually
unrar x archive.rar /tmp/test/
```

**Solutions**:
- Redownload file
- Recreate archive with 7-Zip or WinRAR
- Check file integrity with CRC

### 4. "No log files found in archive"

**Problem**: Archive extracts but no .log/.txt/.json files

**Debug**:

```bash
# List all files in archive
unrar l archive.rar

# Run analyzer
node scripts/tools/analyze-archive.js archive.rar
```

**Solution**:
- Ensure archive contains .log/.txt/.json files
- Check filename patterns match LOG_FILE_PATTERN

### 5. "Password-protected archive not supported"

**Problem**: Encrypted RAR file rejected

**Solution**:

```bash
# Extract without password
unrar x -y archive.rar

# Create unencrypted archive
rar a -y archive_unenc.rar *.log
```

## Network/Upload Issues

### Upload timeout (10 minutes)

**Symptom**: Upload hangs after partial transfer

**Causes**:
- Large file + slow connection
- Server timeout reached
- Network interruption

**Fix**:

```bash
# Increase timeout in server.js
server.timeout = 600000; // 10 minutes

# Or split the file
split -b 500m archive.rar archive.part
```

### "File size exceeds limit"

Check environment:

```bash
grep UPLOAD_MAX /env
# Default: 1GB

# Increase if needed
echo "UPLOAD_MAX_FILES=20" >> .env
echo "UPLOAD_MAX_SIZE=2147483648" >> .env  # 2GB
```

## Database Issues

### Import job stuck in "processing"

Check status:

```sql
SELECT id, filename, status, started_at, completed_at 
FROM import_jobs 
WHERE status = 'processing' 
ORDER BY created_at DESC;
```

**Solution**:

```bash
# Reset stuck job
UPDATE import_jobs SET status = 'failed', 
error_message = 'Manual reset' WHERE id = 'UUID';
```

## Performance Tuning

### Slow extraction

**Optimize**:

```javascript
// Increase batch size
process.env.IMPORT_BATCH_SIZE = 1000;  // Default: 500

// Adjust timeout for cloud
const EXTRACT_TIMEOUT_MS = process.env.RENDER ? 180000 : 30000;
```

### High memory usage

**Problem**: Node process using lots of RAM during RAR extraction

**Causes**:
- Large uncompressed files
- Many simultaneous extractions
- Memory leak

**Check**:

```bash
# Monitor memory
while true; do ps aux | grep node; sleep 1; done

# Check extraction
grep "rar_extract\|7z_extract" logs/logsystem.log
```

**Fix**:

```bash
# Increase Node heap (if needed)
node --max-old-space-size=2048 server.js

# Or limit concurrent uploads
const importLimiter = rateLimit({
  windowMs: 60000,
  max: 3,  // 3 uploads per minute
});
```

## Platform-Specific Issues

### Vercel (Serverless)

**Issue**: WASM loading fails intermittently

**Solution**:

```javascript
// archiveHandler.js already handles this with caching
// But ensure WASM path is correct:
const wasmPaths = [
  path.join(__dirname, '..', 'assets', 'unrar.wasm'),
  path.join(process.cwd(), 'node_modules', 'node-unrar-js', 'dist', 'js', 'unrar.wasm'),
];
```

### Render (Ephemeral filesystem)

**Issue**: Temp files cleaned up during extraction

**Solution**: Already handled in archiveHandler.js

```javascript
const IS_RENDER = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME);
const EXTRACT_TIMEOUT_MS = IS_CLOUD ? 120000 : 30000;
```

## Testing & Validation

### Create test RAR

```bash
# Create sample logs
for i in {1..100}; do
  echo "[2024-01-15 10:${i:(-2)}:00] INFO Log line $i" >> test.log
done

# Create RAR
rar a test.rar test.log

# Test upload
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test.rar" \
  -F "source=test" \
  http://localhost:3001/api/import/upload
```

### Automated tests

```bash
# Run extraction tests
node scripts/maintenance/test-rar-extraction.js test.rar

# Analyze archive
node scripts/tools/analyze-archive.js test.rar
```

## Getting Help

### Collect diagnostics

```bash
#!/bin/bash
echo "=== System Info ==="
uname -a
node --version
npm --version

echo "\n=== Dependencies ==="
npm list | grep -E "node-unrar|7zip|multer"

echo "\n=== Recent Logs ==="
tail -50 logs/logsystem.log | grep -E "ARCHIVE|RAR|extract"

echo "\n=== WASM Status ==="
find node_modules -name "*.wasm" -type f

echo "\n=== Upload Config ==="
grep UPLOAD /env
```

### Report template

```markdown
**Issue**: [Brief description]

**Steps to reproduce**:
1. 
2. 
3. 

**Expected behavior**: 

**Actual behavior**: 

**Environment**:
- Node version:
- Platform:
- Archive size:
- File types:

**Diagnostics**:
[Output from diagnostic script]

**Logs**:
[Relevant log entries]
```
