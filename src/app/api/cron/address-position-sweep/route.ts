/**
 * `GET /api/cron/address-position-sweep` — ο ιδιοκτήτης του κύκλου ζωής της θέσης διεύθυνσης (ADR-332 §D33).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/address-position-sweep.job.ts`, ο φρουρός (μυστικό cron,
 * lease, check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runAddressPositionSweepJob } from '@/lib/cron/jobs/address-position-sweep.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'address-position-sweep',
  label: 'Address position sweep',
  logger: createModuleLogger('ADDRESS_POSITION_SWEEP_CRON'),
  slug: 'address-position-sweep',
  category: 'SENSITIVE',
  run: runAddressPositionSweepJob,
});
