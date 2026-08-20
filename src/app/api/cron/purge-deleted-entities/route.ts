/**
 * =============================================================================
 * CRON: Οριστική διαγραφή οντοτήτων (ADR-281)
 * =============================================================================
 *
 * ⚠️ **ΤΟ GUARD ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ.** Καλεί `executeDeletion()` — **οριστική**
 * διαγραφή με cascade. Μέχρι 2026-07-31 δεν είχε καθόλου ταυτοποίηση: το κάλυπτε κατά
 * λάθος το bot-block του `middleware.ts`, που φιλτράρει user-agent — αλλάζει σε ένα
 * δευτερόλεπτο και **δεν είναι εξουσιοδότηση**. Επιβάλλεται από
 * `src/lib/cron/__tests__/cron-route-contract.test.ts`.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * 🔴 **ΤΟ ROUTE ΚΑΛΟΥΣΕ ΑΛΛΗ ΣΥΝΑΡΤΗΣΗ ΑΠΟ ΤΟΝ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΤΗ** (§8.27):
 * `purgeDeletedEntities()` αντί για `runPurgeDeletedEntities()`. Δηλαδή η χειροκίνητη εκτέλεση
 * δοκίμαζε **άλλη διαδρομή** από αυτήν που τρέχει στην παραγωγή.
 *
 * @module api/cron/purge-deleted-entities
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runPurgeDeletedEntities } from '@/lib/cron/jobs/purge-deleted-entities.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'purge-deleted-entities',
  label: 'Entity purge',
  logger: createModuleLogger('CronPurgeDeletedEntities'),
  run: runPurgeDeletedEntities,
});
