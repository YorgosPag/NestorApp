/**
 * 📅 Stay channel iCal import — ADR-835 §22 (Στάδιο Γ)
 *
 * **Πυροκροτητής, όχι λογική.** Ποιες πηγές οφείλονται το κρίνει το
 * `stay-channel-poll.service`, η διαφορά γράφεται στη συναλλαγή της κεφαλής
 * (`stay-channel-import.service`), και ο προσαρμογέας ζει στο
 * `lib/cron/jobs/stay-channel-import.job.ts`.
 *
 * ⚠️ **Αυτή η διαδρομή ΚΛΕΙΝΕΙ ΚΑΙ ΑΝΟΙΓΕΙ ΝΥΧΤΕΣ** σε ξένα ημερολόγια, οπότε η
 * ταυτοποίηση γίνεται με το **υπάρχον** SSoT (`verifyCronAuthorization` → `CRON_SECRET`,
 * ADR-740). Χωρίς έγκυρο μυστικό **καμία δημοσκόπηση δεν τρέχει**.
 *
 * ⏱️ `maxDuration = 300`: κάθε πηγή είναι εξωτερικό αίτημα με όριο 15″, και ένα πέρασμα
 * αγγίζει ως 25 ακίνητα. Το όριο πλήθους ζει στο `stay-channel-poll.service`, ώστε το
 * πέρασμα να **τελειώνει** αντί να σκοτώνεται στη μέση.
 *
 * @module api/cron/stay-channel-import
 */

import 'server-only';

import { runStayChannelImport } from '@/lib/cron/jobs/stay-channel-import.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'stay-channel-import',
  label: 'Stay channel iCal import',
  logger: createModuleLogger('STAY_CHANNEL_IMPORT_CRON'),
  slug: 'stay-channel-import',
  run: runStayChannelImport,
});
