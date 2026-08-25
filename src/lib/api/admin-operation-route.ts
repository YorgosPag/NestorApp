/**
 * =============================================================================
 * ΑΜΕΣΗ ΔΙΟΙΚΗΤΙΚΗ ΕΠΕΜΒΑΣΗ — ο ΕΝΑΣ ορισμός (ADR-801 §2.11 / ADR-245)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιος επιτρέπεται να τρέξει break-glass επέμβαση στα δεδομένα;»*
 *
 * Η απάντηση ήταν γραμμένη **επτά φορές** ως λεκτικό, σε τρία αρχεία
 * (`bootstrap-company` · `migrate-accounting-profile` · `migrate-accounting-singletons`):
 *
 * ```ts
 * { requiredGlobalRoles: BYPASS_ROLES, permissions: 'admin:direct:operations' }
 * ```
 *
 * ⚠️ **Επτά αντίγραφα μιας απόφασης εξουσιοδότησης δεν είναι ύφος — είναι επτά
 * αυθεντίες που περιμένουν να αποκλίνουν.** Αρκεί ένα από αυτά να αποκτήσει άλλο
 * `permissions` και **κανείς δεν το μαθαίνει**: ο μεταγλωττιστής δεν έχει γνώμη για
 * μια συμβολοσειρά, και ο επόμενος που αντιγράφει το route αντιγράφει ό,τι βρει.
 * Ίδιο σχήμα με τις έξι απαντήσεις του `authority.ts` (ADR-801) — εκεί το «ποιος
 * είναι διαχειριστής;», εδώ το «ποιος επεμβαίνει άμεσα;».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏛️ ΤΟ ΠΡΟΤΥΠΟ — ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ίδια κίνηση με το `runGuarded` (ADR-245, `lib/api/guarded-route.ts`), που
 * γεννήθηκε από **το ίδιο ακριβώς περιστατικό**: το CHECK 3.28 μπλόκαρε επειδή
 * η αλυσίδα εξουσιοδότησης ήταν ξαναγραμμένη ανά verb. Εδώ ζει **μόνο** η
 * αλυσίδα· ο χειριστής, το try/catch και το σώμα της απάντησης μένουν στο route.
 *
 * ⚠️ **ΔΕΝ καταπίνει σφάλματα επίτηδες**: κάθε endpoint αναφέρει τη δική του
 * αποτυχία (το `bootstrap-company` επιστρέφει `executionTimeMs`, τα migrations
 * όχι). Ένα κοινό `catch` εδώ θα ισοπέδωνε **διαφορετικά** συμβόλαια απάντησης
 * για να ευχαριστήσει έναν ανιχνευτή κλώνων — αυτό είναι το αντίθετο του SSoT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΟΝΟΜΑΤΑ, ΟΧΙ ΜΙΑ ΣΗΜΑΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * `read` = προεπισκόπηση / dry-run (μηδέν εγγραφές) ⇒ χωρίς όριο ρυθμού.
 * `write` = εκτέλεση ⇒ **SENSITIVE** όριο ρυθμού (10 req/min).
 * Ένα boolean `{ rateLimit }` θα έκρυβε αυτή τη διαφορά πίσω από μια τιμή που ο
 * καλών μπορεί να ξεχάσει· δύο ονόματα την κάνουν **δήλωση πρόθεσης**.
 *
 * @module lib/api/admin-operation-route
 * @enterprise ADR-801 — ένας κριτής για το «επιτρέπεται;»
 * @see lib/api/guarded-route — ο αδελφός για τα κανονικά (μη break-glass) routes
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth, BYPASS_ROLES } from '@/lib/auth';
import type { AuthenticatedHandler, WithAuthOptions } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * Η **μία** δήλωση του «άμεση διοικητική επέμβαση»:
 * ταβάνι ρόλου (μόνο υπερδιαχειριστής) **και** ρητή ικανότητα.
 *
 * ⚠️ **ΜΗΝ γράψεις ξανά αυτό το ζεύγος σε route.** Το CHECK 3.68 φυλά τον κριτή
 * της ικανότητας· αυτή η σταθερά φυλά το **σημείο δήλωσης** στο σύνορο HTTP.
 */
export const ADMIN_DIRECT_OPERATION_GUARD: WithAuthOptions = {
  requiredGlobalRoles: BYPASS_ROLES,
  permissions: 'admin:direct:operations',
} as const;

/**
 * Ρήμα **ανάγνωσης** άμεσης διοικητικής επέμβασης (προεπισκόπηση / dry-run).
 *
 * Χωρίς όριο ρυθμού: δεν γράφει τίποτα και συχνά καλείται επαναληπτικά ενώ ο
 * διαχειριστής επιβεβαιώνει τι πρόκειται να συμβεί.
 */
export function adminDirectOperationRead<T = unknown, R = unknown>(
  handler: AuthenticatedHandler<T, R>,
): (request: NextRequest, routeContext?: R) => Promise<NextResponse> {
  return withAuth<T, R>(handler, ADMIN_DIRECT_OPERATION_GUARD) as (
    request: NextRequest,
    routeContext?: R,
  ) => Promise<NextResponse>;
}

/**
 * Ρήμα **εγγραφής** άμεσης διοικητικής επέμβασης (εκτέλεση).
 *
 * Πίσω από **SENSITIVE** όριο ρυθμού: κάθε κλήση αλλάζει δεδομένα παραγωγής.
 */
export function adminDirectOperationWrite<T = unknown, R = unknown>(
  handler: AuthenticatedHandler<T, R>,
): (request: NextRequest, routeContext?: R) => Promise<Response> | Response {
  return withSensitiveRateLimit<R>(
    withAuth<T, R>(handler, ADMIN_DIRECT_OPERATION_GUARD),
  );
}
