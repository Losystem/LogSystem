-- Default Error Recommendations Seed
-- Covers common log types and error patterns for immediate value after deployment

-- Check if table exists before inserting
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables 
                     WHERE table_schema = DATABASE() AND table_name = 'error_recommendations');

SET @sql = IF(@table_exists > 0,
  'INSERT INTO error_recommendations (error_type, recommendation, priority, is_active, created_by, created_at, updated_at) VALUES
  -- Database errors
  (''ECONNREFUSED'', ''Connection refused - Check if the database/service is running and accessible. Verify firewall rules and network connectivity.'', 10, 1, 1, NOW(), NOW()),
  (''ETIMEDOUT'', ''Connection timeout - Check network latency, firewall settings, and service availability. Consider increasing timeout values if the service is slow.'', 5, 1, 1, NOW(), NOW()),
  (''ER_ACCESS_DENIED_ERROR'', ''Database access denied - Verify username, password, and permissions. Check if the user has the required privileges for the database.'', 10, 1, 1, NOW(), NOW()),
  (''ER_NO_SUCH_TABLE'', ''Table does not exist - Run database migrations to create missing tables. Verify the schema is up to date.'', 10, 1, 1, NOW(), NOW()),
  (''ER_DUP_ENTRY'', ''Duplicate entry - Check for unique constraint violations. Verify if the record already exists before insertion.'', 5, 1, 1, NOW(), NOW()),
  -- HTTP errors
  (''HTTP 500'', ''Internal Server Error - Check application logs for stack traces. Verify server configuration and dependencies.'', 10, 1, 1, NOW(), NOW()),
  (''HTTP 503'', ''Service Unavailable - The service is temporarily overloaded or down. Check server resources and scaling configuration.'', 10, 1, 1, NOW(), NOW()),
  (''HTTP 404'', ''Not Found - The requested resource does not exist. Verify URL paths and routing configuration.'', 5, 1, 1, NOW(), NOW()),
  (''HTTP 401'', ''Unauthorized - Authentication required. Check API keys, tokens, or user credentials.'', 5, 1, 1, NOW(), NOW()),
  (''HTTP 403'', ''Forbidden - Access denied. Verify user permissions and access control lists.'', 5, 1, 1, NOW(), NOW()),
  -- Node.js errors
  (''TypeError'', ''Type mismatch - Check variable types before operations. Verify API response formats and data structures.'', 5, 1, 1, NOW(), NOW()),
  (''ReferenceError'', ''Undefined variable - Check variable declarations and scope. Verify all required dependencies are imported.'', 5, 1, 1, NOW(), NOW()),
  (''SyntaxError'', ''Syntax error - Check code syntax, especially in dynamically evaluated code or JSON parsing.'', 10, 1, 1, NOW(), NOW()),
  (''RangeError'', ''Value out of range - Check array indices, numeric values, and buffer sizes. Validate input ranges.'', 5, 1, 1, NOW(), NOW()),
  -- File system errors
  (''ENOENT'', ''File or directory not found - Verify file paths and permissions. Check if files were created or moved.'', 5, 1, 1, NOW(), NOW()),
  (''EACCES'', ''Permission denied - Check file/directory permissions. Verify the process has read/write access.'', 10, 1, 1, NOW(), NOW()),
  (''ENOSPC'', ''No space left on device - Check disk space usage. Clean up temporary files and logs.'', 10, 1, 1, NOW(), NOW()),
  -- Memory errors
  (''ENOMEM'', ''Out of memory - Check memory usage and leaks. Consider increasing memory limits or optimizing memory-intensive operations.'', 10, 1, 1, NOW(), NOW()),
  (''HEAP_OUT_OF_MEMORY'', ''Heap memory exhausted - Profile memory usage, check for memory leaks, and optimize data structures.'', 10, 1, 1, NOW(), NOW()),
  -- General patterns
  (''Connection lost'', ''Database connection lost - Check database server status, network stability, and connection pool configuration.'', 10, 1, 1, NOW(), NOW()),
  (''Deadlock'', ''Database deadlock detected - Review transaction order and lock acquisition. Consider retry logic with exponential backoff.'', 10, 1, 1, NOW(), NOW()),
  (''Certificate expired'', ''SSL/TLS certificate expired - Renew certificates and update trusted CA bundles. Check system time.'', 10, 1, 1, NOW(), NOW()),
  (''Rate limit exceeded'', ''API rate limit exceeded - Implement request throttling and exponential backoff. Check API quota limits.'', 5, 1, 1, NOW(), NOW()),
  -- Application-specific
  (''Validation failed'', ''Input validation failed - Check data formats, required fields, and validation rules. Verify API documentation.'', 5, 1, 1, NOW(), NOW()),
  (''Authentication failed'', ''Authentication failure - Verify credentials, tokens, and authentication flow. Check account status.'', 10, 1, 1, NOW(), NOW()),
  (''Authorization failed'', ''Authorization failure - Check user permissions and role assignments. Verify access control policies.'', 10, 1, 1, NOW(), NOW())
  ON DUPLICATE KEY UPDATE recommendation = VALUES(recommendation), priority = VALUES(priority), updated_at = NOW()',
  'SELECT ''Table error_recommendations does not exist, skipping seed'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT IF(@table_exists > 0, 'Default recommendations seeded successfully', 'Table does not exist, skipping') AS message;
