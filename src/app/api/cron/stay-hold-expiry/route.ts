/**
 * ⏳ Stay hold expiry — ADR-835 §23.7 (Στάδιο Δ)
 *
 * **Πυροκροτητής, όχι λογική.** Το «έληξε;» ζει στους τύπους (`stayBookingOccupiesAt`), η
 * καταγραφή στον ΕΝΑ γραφέα (πράξη `expire`), το πέρασμα στο `stay-hold-expiry.service` και ο
 * προσαρμογέας στο `lib/cron/jobs/stay-hold-expiry.job.ts`.
 *
 * ⚠️ **Αυτή η διαδρομή ΓΡΑΦΕΙ ΚΑΤΑΣΤΑΣΗ ΚΡΑΤΗΣΕΩΝ και στέλνει ειδοποιήσεις**, οπότε η ταυτοποίηση
 * γίνεται με το **υπάρχον** SSoT (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740). Χωρίς έγκυρο
 * μυστικό **κανένα πέρασμα δεν τρέχει** — και οι νύχτες ελευθερώνονται **ούτως ή άλλως** στην ανάγνωση.
 *
 * @module api/cron/stay-hold-expiry
 */

import 'server-only';

import { runStayHoldExpiry } from '@/lib/cron/jobs/stay-hold-expiry.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'stay-hold-expiry',
  label: 'Stay request hold expiry',
  logger: createModuleLogger('STAY_HOLD_EXPIRY_CRON'),
  slug: 'stay-hold-expiry',
  run: runStayHoldExpiry,
});
