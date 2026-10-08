/**
 * `GET /api/cron/listing-media-reconcile` — η βραδινή συμφιλίωση των μέσων αγγελίας (ADR-845 §7.17 Α5).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/listing-media-reconcile.job.ts`, ο φρουρός
 * (μυστικό cron, lease, check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runListingMediaReconcile } from '@/lib/cron/jobs/listing-media-reconcile.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'listing-media-reconcile',
  label: 'Listing media reconciliation',
  logger: createModuleLogger('LISTING_MEDIA_RECONCILE_CRON'),
  slug: 'listing-media-reconcile',
  category: 'SENSITIVE',
  run: runListingMediaReconcile,
});
