/**
 * `GET /api/cron/listing-stats-rollup` — η νυχτερινή σύνοψη προβολών αγγελίας (ADR-777 §8.72).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/listing-stats-rollup.job.ts`, ο φρουρός
 * (μυστικό cron, lease, check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runListingStatsRollup } from '@/lib/cron/jobs/listing-stats-rollup.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'listing-stats-rollup',
  label: 'Listing view stats rollup',
  logger: createModuleLogger('LISTING_STATS_ROLLUP_CRON'),
  slug: 'listing-stats-rollup',
  run: runListingStatsRollup,
});
