/**
 * 💳 Payment reconcile — ADR-ACC-030 §5
 *
 * **Πυροκροτητής, όχι λογική.** Ο συγχρονισμός ζει στο `invoice-payment-settlement-sync` (ο ΙΔΙΟΣ με το webhook),
 * το πέρασμα στο `payment-reconcile.service` και ο προσαρμογέας στο `lib/cron/jobs/payment-reconcile.job.ts`.
 *
 * ⚠️ **Αυτή η διαδρομή ΚΑΤΑΓΡΑΦΕΙ ΠΛΗΡΩΜΕΣ ΤΙΜΟΛΟΓΙΩΝ**, οπότε η ταυτοποίηση γίνεται με το υπάρχον SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740). Χωρίς έγκυρο μυστικό κανένα πέρασμα δεν τρέχει.
 *
 * @module api/cron/payment-reconcile
 */

import 'server-only';

import { runPaymentReconcile } from '@/lib/cron/jobs/payment-reconcile.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'payment-reconcile',
  label: 'Online invoice payment reconciliation',
  logger: createModuleLogger('PAYMENT_RECONCILE_CRON'),
  slug: 'payment-reconcile',
  run: runPaymentReconcile,
  category: 'SENSITIVE',
});
