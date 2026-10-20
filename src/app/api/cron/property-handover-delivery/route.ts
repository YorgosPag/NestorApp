/**
 * `GET /api/cron/property-handover-delivery` — η παράδοση αρχείων στον φάκελο του αγοραστή (ADR-916 Φ-Γ1).
 *
 * Λεπτό περιτύλιγμα: η πράξη ζει στο `lib/cron/jobs/property-handover-delivery.job.ts`, ο φρουρός (μυστικό cron, lease,
 * check-in) στο `createScanCronRoute` — ίδιο σχήμα με κάθε σάρωση του έργου. Ο εκτελεστής σταματά στα 240s από τα 300.
 */

import 'server-only';

import { runPropertyHandoverDelivery } from '@/lib/cron/jobs/property-handover-delivery.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'property-handover-delivery',
  label: 'Property handover file delivery',
  logger: createModuleLogger('PROPERTY_HANDOVER_DELIVERY_CRON'),
  slug: 'property-handover-delivery',
  category: 'SENSITIVE',
  run: runPropertyHandoverDelivery,
});
