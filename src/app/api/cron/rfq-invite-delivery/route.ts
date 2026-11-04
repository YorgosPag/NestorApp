/**
 * `GET /api/cron/rfq-invite-delivery` — η παράδοση προσκλήσεων RFQ που δεν πρόλαβε το αίτημα (ADR-923 §5.13 Τ5).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/rfq-invite-delivery.job.ts`, ο φρουρός (μυστικό cron, lease,
 * check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου.
 */

import 'server-only';

import { runRfqInviteDelivery } from '@/lib/cron/jobs/rfq-invite-delivery.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'rfq-invite-delivery',
  label: 'RFQ invite delivery',
  logger: createModuleLogger('RFQ_INVITE_DELIVERY_CRON'),
  slug: 'rfq-invite-delivery',
  category: 'SENSITIVE',
  run: runRfqInviteDelivery,
});
