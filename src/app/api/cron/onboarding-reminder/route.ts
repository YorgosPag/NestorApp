/**
 * =============================================================================
 * CRON: Υπενθύμιση ημιτελούς onboarding (ADR-326 §8)
 * =============================================================================
 *
 * Η σάρωση και η σύνθεση του email ζουν στο `lib/cron/jobs/onboarding-reminder.job.ts`.
 *
 * 🔴 **ΕΔΩ Η ΠΑΡΑΚΑΜΨΗ ΕΙΧΕ ΣΥΝΕΠΕΙΑ, ΟΧΙ ΜΟΝΟ ΣΧΗΜΑ.** Το `runOnboardingReminder`
 * **πετά** όταν *κάθε* αποστολή απέτυχε (`errors > 0 && sent === 0`), ώστε να το δει
 * το Sentry monitor. Καλώντας `sendOnboardingReminders()` απευθείας, το route
 * παρέκαμπτε αυτόν τον φρουρό και επέστρεφε **`ok: true` σε ολική αποτυχία**.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * 🔴 **ΤΟ ROUTE ΚΑΛΟΥΣΕ ΑΛΛΗ ΣΥΝΑΡΤΗΣΗ ΑΠΟ ΤΟΝ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΤΗ** (§8.27):
 * `sendOnboardingReminders()` αντί για `runOnboardingReminder()`. Δηλαδή η χειροκίνητη εκτέλεση
 * δοκίμαζε **άλλη διαδρομή** από αυτήν που τρέχει στην παραγωγή.
 *
 * @module api/cron/onboarding-reminder
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runOnboardingReminder } from '@/lib/cron/jobs/onboarding-reminder.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'onboarding-reminder',
  label: 'Onboarding reminder',
  logger: createModuleLogger('ONBOARDING_REMINDER_CRON'),
  run: runOnboardingReminder,
});
