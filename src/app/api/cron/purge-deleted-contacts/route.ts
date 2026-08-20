/**
 * =============================================================================
 * CRON: Οριστική διαγραφή επαφών (ADR-281)
 * =============================================================================
 *
 * ⚠️ **ΟΡΙΣΤΙΚΗ διαγραφή με cascade** — ίδιος φρουρός, ίδιος λόγος με το
 * `purge-deleted-entities`.
 *
 * 🔴 **ΕΛΕΙΠΕ ΑΠΟ ΤΗ ΛΙΣΤΑ ΜΕΤΑΝΑΣΤΕΥΣΗΣ** (§8.27): το handoff ονόμαζε **επτά**
 * διαδρομές με διπλότυπο wiring· ήταν **οκτώ**. Μια χειρόγραφη λίστα που αποκλίνει
 * από το δέντρο είναι το σχήμα του CHECK 3.34 — γι’ αυτό μετρήθηκε αντί να
 * αντιγραφεί.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * 🔴 **ΤΟ ROUTE ΚΑΛΟΥΣΕ ΑΛΛΗ ΣΥΝΑΡΤΗΣΗ ΑΠΟ ΤΟΝ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΤΗ** (§8.27):
 * `purgeDeletedContacts()` αντί για `runPurgeDeletedContacts()`. Δηλαδή η χειροκίνητη εκτέλεση
 * δοκίμαζε **άλλη διαδρομή** από αυτήν που τρέχει στην παραγωγή.
 *
 * @module api/cron/purge-deleted-contacts
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runPurgeDeletedContacts } from '@/lib/cron/jobs/purge-deleted-contacts.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'purge-deleted-contacts',
  label: 'Contact purge',
  logger: createModuleLogger('CronPurgeDeletedContacts'),
  run: runPurgeDeletedContacts,
});
