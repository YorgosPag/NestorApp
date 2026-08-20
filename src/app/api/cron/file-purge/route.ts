/**
 * =============================================================================
 * CRON: Εκκαθάριση κάδου αρχείων + ορφανών (ADR-191)
 * =============================================================================
 *
 * Οι δύο φάσεις ζουν στο `lib/cron/jobs/file-purge.job.ts`.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * 🔴 **ΤΟ ROUTE ΚΑΛΟΥΣΕ ΑΛΛΗ ΣΥΝΑΡΤΗΣΗ ΑΠΟ ΤΟΝ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΤΗ** (§8.27):
 * `purgeFiles()` αντί για `runFilePurge()`. Δηλαδή η χειροκίνητη εκτέλεση
 * δοκίμαζε **άλλη διαδρομή** από αυτήν που τρέχει στην παραγωγή.
 *
 * @module api/cron/file-purge
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runFilePurge } from '@/lib/cron/jobs/file-purge.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'file-purge',
  label: 'File purge',
  logger: createModuleLogger('CronFilePurge'),
  run: runFilePurge,
});
