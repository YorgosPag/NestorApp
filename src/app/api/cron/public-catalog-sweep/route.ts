/**
 * `GET /api/cron/public-catalog-sweep` — το δίχτυ της δημόσιας βιτρίνας καταλόγου (ADR-923 §5.13 Δ3).
 * Λεπτό περιτύλιγμα: η πράξη στο `lib/cron/jobs/public-catalog-sweep.job.ts`, ο φρουρός στο `createScanCronRoute`.
 */

import 'server-only';

import { runPublicCatalogSweep } from '@/lib/cron/jobs/public-catalog-sweep.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'public-catalog-sweep',
  label: 'Public catalog sweep',
  logger: createModuleLogger('PUBLIC_CATALOG_SWEEP_CRON'),
  slug: 'public-catalog-sweep',
  run: runPublicCatalogSweep,
});
