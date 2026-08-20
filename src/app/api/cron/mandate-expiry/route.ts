/**
 * 🏢 Mandate Expiry Cron Endpoint — ADR-777 §8.33
 *
 * **Πυροκροτητής, όχι λογική.** Η κρίση «έληξε;» ζει στους τύπους
 * (`mandateAllowsPublication`), η πράξη στο `services/mandate/mandate-expiry.service.ts`,
 * ο προσαρμογέας στο `lib/cron/jobs/mandate-expiry.job.ts`.
 *
 * ⚠️ **Αυτή η διαδρομή ΚΑΤΕΒΑΖΕΙ ΔΗΜΟΣΙΕΣ ΑΓΓΕΛΙΕΣ.** Δεν στέλνει email και δεν
 * αποκαλύπτει τίποτα — αλλά αφαιρεί προβολές, οπότε η ταυτοποίηση γίνεται με το
 * **υπάρχον** SSoT (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740). Χωρίς έγκυρο
 * μυστικό **καμία σάρωση δεν τρέχει**.
 *
 * @module api/cron/mandate-expiry
 * @see ADR-777 §8.33 — «η εντολή λήγει, δεν σβήνει»
 */

import 'server-only';

import { runMandateExpiry } from '@/lib/cron/jobs/mandate-expiry.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'mandate-expiry',
  label: 'Mandate expiry sweep',
  logger: createModuleLogger('MANDATE_EXPIRY_CRON'),
  run: runMandateExpiry,
});
