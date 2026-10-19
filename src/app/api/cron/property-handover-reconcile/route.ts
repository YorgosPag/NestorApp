/**
 * `GET /api/cron/property-handover-reconcile` — η βραδινή συμφιλίωση των παραδόσεων φακέλου (ADR-916 §5.4).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/property-handover-reconcile.job.ts`, ο φρουρός
 * (μυστικό cron, lease, check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runPropertyHandoverReconcile } from '@/lib/cron/jobs/property-handover-reconcile.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'property-handover-reconcile',
  label: 'Property handover reconciliation',
  logger: createModuleLogger('PROPERTY_HANDOVER_RECONCILE_CRON'),
  slug: 'property-handover-reconcile',
  category: 'SENSITIVE',
  run: runPropertyHandoverReconcile,
});
