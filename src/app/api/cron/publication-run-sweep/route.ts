/**
 * `GET /api/cron/publication-run-sweep` — το δίχτυ των εκδόσεων καταλόγου (ADR-923 §5.6).
 * Λεπτό περιτύλιγμα: η πράξη στο `lib/cron/jobs/publication-run-sweep.job.ts`, ο φρουρός στο `createScanCronRoute`.
 */

import 'server-only';

import { runPublicationRunSweep } from '@/lib/cron/jobs/publication-run-sweep.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'publication-run-sweep',
  label: 'Catalog publication run sweep',
  logger: createModuleLogger('PUBLICATION_RUN_SWEEP_CRON'),
  slug: 'publication-run-sweep',
  run: runPublicationRunSweep,
});
