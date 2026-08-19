/**
 * 🏢 Outbound Email Flush Cron Endpoint — ADR-777 §8.23
 *
 * **Πυροκροτητής, όχι λογική.** Η παράδοση ζει στο
 * `lib/cron/jobs/outbound-email-flush.job.ts`, το wiring HTTP στο
 * `lib/cron/scan-cron-route.ts`.
 *
 * ⚠️ **Η ΔΙΑΔΡΟΜΗ ΑΥΤΗ ΠΑΡΑΔΙΔΕΙ EMAIL ΣΕ ΑΝΘΡΩΠΟΥΣ.** Η ταυτοποίηση γίνεται με
 * το **υπάρχον** SSoT (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740).
 * Χωρίς έγκυρο μυστικό **καμία παράδοση δεν τρέχει**.
 *
 * @module api/cron/outbound-email-flush
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts (κάθε 10 λεπτά)
 * @see ADR-777 §8.23
 */

import 'server-only';

import { runOutboundEmailFlush } from '@/lib/cron/jobs/outbound-email-flush.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'outbound-email-flush',
  label: 'Outbound email flush',
  logger: createModuleLogger('OUTBOUND_EMAIL_FLUSH_CRON'),
  run: runOutboundEmailFlush,
});
