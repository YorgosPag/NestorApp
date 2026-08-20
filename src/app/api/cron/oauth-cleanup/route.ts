/**
 * =============================================================================
 * CRON: Εκκαθάριση ληγμένων εγγράφων OAuth (ADR-738 §10)
 * =============================================================================
 *
 * Η *πολιτική* (τι σβήνεται, πότε, και γιατί όχι νωρίτερα) ζει ολόκληρη στο
 * `lib/oauth/oauth-cleanup.ts`.
 *
 * ⚠️ **Μην πειράξεις τα δύο παράθυρα διατήρησης** (ADR-738 §10.1) — το δεύτερο
 * τροφοδοτεί ανιχνευτή επαναχρησιμοποίησης κωδικού· συντόμευσή του σπάει τον
 * ανιχνευτή κλοπής.
 *
 * ℹ️ Το path παραμένει **ονομαστική** εξαίρεση στο `isMachineEndpoint` του
 * `middleware.ts`, ώστε να είναι δοκιμάσιμο χειροκίνητα με `curl`.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * 🔴 **ΤΟ ROUTE ΚΑΛΟΥΣΕ ΑΛΛΗ ΣΥΝΑΡΤΗΣΗ ΑΠΟ ΤΟΝ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΤΗ** (§8.27):
 * `cleanupExpiredOAuthDocuments()` αντί για `runOAuthCleanup()`. Δηλαδή η χειροκίνητη εκτέλεση
 * δοκίμαζε **άλλη διαδρομή** από αυτήν που τρέχει στην παραγωγή.
 *
 * @module api/cron/oauth-cleanup
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runOAuthCleanup } from '@/lib/cron/jobs/oauth-cleanup.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'oauth-cleanup',
  label: 'OAuth cleanup',
  logger: createModuleLogger('CronOAuthCleanup'),
  run: runOAuthCleanup,
});
