/**
 * `GET /api/cron/area-market-rollup` — η νυχτερινή σύνοψη ζητούμενων τιμών ανά περιοχή (ADR-890 §5.2).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/area-market-rollup.job.ts`, ο φρουρός
 * (μυστικό cron, lease, check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runAreaMarketRollup } from '@/lib/cron/jobs/area-market-rollup.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'area-market-rollup',
  label: 'Area market asking-price rollup',
  logger: createModuleLogger('AREA_MARKET_ROLLUP_CRON'),
  slug: 'area-market-rollup',
  run: runAreaMarketRollup,
});
