/**
 * 🏢 Holiday Hours Question Cron Endpoint — ADR-841 §7 Α21.21 Φάση Β
 *
 * **Πυροκροτητής, όχι λογική.** Η κρίση «ποια περίοδος ωρίμασε;» ζει στο `lib/calendar/holiday-question`, η πράξη στο
 * `services/mandate/holiday-hours-question.service.ts`, ο προσαρμογέας στο `lib/cron/jobs/holiday-hours-question.job.ts`.
 *
 * ⚠️ **Αυτή η διαδρομή ΣΤΕΛΝΕΙ EMAIL σε διαχειριστές γραφείων.** Η ταυτοποίηση γίνεται με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740). Χωρίς έγκυρο μυστικό **καμία σάρωση δεν τρέχει**, και η
 * επανάληψη είναι ακίνδυνη: κλειδί ερώτησης ντετερμινιστικό, αποδιπλοποίηση ειδοποίησης ανά (ερώτηση, στάδιο, παραλήπτη).
 *
 * @module api/cron/holiday-hours-question
 */

import 'server-only';

import { runHolidayHoursQuestion } from '@/lib/cron/jobs/holiday-hours-question.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'holiday-hours-question',
  label: 'Holiday hours question sweep',
  logger: createModuleLogger('HOLIDAY_HOURS_QUESTION_CRON'),
  slug: 'holiday-hours-question',
  run: runHolidayHoursQuestion,
});
