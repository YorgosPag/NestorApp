/**
 * `GET /api/cron/catalog-media-quarantine-sweep` — το δίχτυ της καραντίνας μέσων καταλόγου (ADR-934 §5.2.2 Μ-β5).
 * Λεπτό περιτύλιγμα: η πράξη στο `lib/cron/jobs/catalog-media-quarantine-sweep.job.ts`, ο φρουρός στο `createScanCronRoute`.
 */

import 'server-only';

import { runCatalogMediaQuarantineSweep } from '@/lib/cron/jobs/catalog-media-quarantine-sweep.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'catalog-media-quarantine-sweep',
  label: 'Catalog media quarantine sweep',
  logger: createModuleLogger('CATALOG_MEDIA_QUARANTINE_SWEEP_CRON'),
  slug: 'catalog-media-quarantine-sweep',
  run: runCatalogMediaQuarantineSweep,
});
