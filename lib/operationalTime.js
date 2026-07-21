/**
 * Operational time for dashboards, alerts, and live views.
 * Uses ingestion time so bulk imports appear in "today" windows on Render/cloud.
 */
export const OPERATIONAL_TS = 'imported_at';

/** SQL expression: prefer ingestion time, fall back to event/created time. */
export const OPERATIONAL_TS_EXPR = 'COALESCE(imported_at, timestamp, created_at)';

export function isCloudDeployment() {
  return !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.RENDER ||
    process.env.RENDER_SERVICE_NAME
  );
}
