/**
 * @fileoverview Shared requireAuthContext — Centralized auth context extraction
 * @description Extracts TenantContext from Firebase Auth custom claims (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 *
 * Pattern extracted from:
 * - src/services/crm/tasks/repositories/TasksRepository.ts (lines 19-45)
 * - src/services/calendar/AppointmentsRepository.ts
 */

import { auth, waitForAuthReady } from '@/lib/firebase';
import type { TenantContext } from './firestore-query.types';
import { getSuperAdminActiveCompanyId } from './super-admin-active-company';

/**
 * 🔑 **ΜΕΤΑΚΙΝΗΘΗΚΕ, ΔΕΝ ΔΙΠΛΑΣΙΑΣΤΗΚΕ (2026-08-28).** Ο ορισμός ζούσε εδώ· δεν έχει όμως
 * **τίποτα** από Firestore — είναι καθαρά Firebase Auth. Όταν την ίδια απάντηση χρειάστηκε
 * και η διαδρομή HTTP (`lib/api/enterprise-api-client`), το `lib/` θα εισήγαγε από το
 * `services/` — ανάποδο στρώμα, και μετρημένα έσπασε **τρεις** σουίτες στο import.
 * Ο ορισμός πήγε δίπλα στο `auth` που ρωτά· εδώ μένει **ξανα-εξαγωγή**, ώστε οι υπάρχοντες
 * καλούντες (`firestore-query.service.ts`) και τα διπλά τους να μην αγγιχτούν καθόλου.
 */
export { waitForAuthReady } from '@/lib/firebase';

/**
 * **«ΔΕΝ ΑΝΗΚΕΙΣ ΣΕ ΕΤΑΙΡΕΙΑ» ΕΙΝΑΙ ΣΧΕΔΙΑΣΜΕΝΗ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΒΛΑΒΗ** (ADR-809).
 *
 * Ο αυτόνομος επαγγελματίας — ο persona του **ADR-807** — δεν έχει `companyId`
 * **εκ σχεδιασμού**. Κάθε καταναλωτής που πιάνει αυτό το σφάλμα οφείλει να
 * ξεχωρίσει *«ο άνθρωπος δουλεύει μόνος του»* από *«η Firestore έπεσε»*, γιατί
 * η **πρώτη** θέλει σιωπηλή, σωστή απάντηση και η **δεύτερη** κόκκινο.
 *
 * 🔴 **Το κόστος του να μην ξεχωρίζουν**: μετρημένο 2026-08-26, ο
 * `EnterpriseSecurityService` κατέγραφε κόκκινο `[ERROR]` σε **κάθε φόρτωση
 * σελίδας** για ολόκληρη κλάση χρηστών, ενώ ο fallback του ήταν **η σωστή
 * απάντηση**. Σχεδιασμένη κατάσταση αναφερόμενη ως βλάβη — το **ίδιο σχήμα** με
 * το ADR-807, όπου το «δεν έχεις εταιρεία» διαβαζόταν ως «δεν υπάρχεις». Ο
 * θόρυβος κρύβει τα αληθινά σφάλματα.
 *
 * ⚠️ **Η ΤΑΥΤΟΤΗΤΑ ΖΕΙ ΕΔΩ, ΜΙΑ ΦΟΡΑ.** Πριν από αυτό ήταν **πρόθεμα
 * συμβολοσειράς** γραμμένο σε **τέσσερα** σημεία — και το ένα από αυτά
 * (`obligation-transmittal-operations.ts:77`) έγραφε **άλλο μήνυμα**, δηλαδή
 * κριτής που ταιριάζει κείμενο ήταν τυφλός ακριβώς εκεί. ✅ Από 2026-08-26
 * (ADR-813) τα τέσσερα έγιναν **ένα**: αυτό.
 */
export const MISSING_TENANT_MESSAGE = 'AUTHORIZATION_ERROR: User is not assigned to a company';

/**
 * Το σφάλμα με **ρητή** ταυτότητα — το μήνυμα μένει **αυτούσιο** για συμβατότητα.
 *
 * ⚠️ **Το `isMissingTenant` ΔΕΝ είναι διακοσμητικό — ΕΙΝΑΙ η ταυτότητα που
 * διαβάζει ο κριτής.** Μέχρι 2026-08-26 το έγραφε η κλάση και **δεν το διάβαζε
 * κανείς** (μετρημένο: **0** αναγνώστες σε όλο το `src/`), ενώ ο κριτής ρωτούσε
 * `instanceof` — δηλαδή η κλάση κουβαλούσε τη θεραπεία και κανείς δεν την
 * έπαιρνε. **Αδρανής φρουρός** (σχήμα ADR-749 §5).
 */
export class MissingTenantError extends Error {
  readonly isMissingTenant = true as const;

  constructor() {
    super(MISSING_TENANT_MESSAGE);
    this.name = 'MissingTenantError';
  }
}

/**
 * «Είναι αυτό το σφάλμα ο **αυτόνομος επαγγελματίας**, ή **πραγματική βλάβη**;»
 *
 * ✅ **Η ΜΕΤΑΝΑΣΤΕΥΣΗ ΕΚΛΕΙΣΕ (ADR-813, 2026-08-26).** Τα τρία σημεία που
 * πετούσαν σκέτο `Error` (`contacts.service.ts` · `InMemoryObligationsRepository.ts`
 * · `obligation-transmittal-operations.ts`) πετούν πλέον `MissingTenantError`.
 * ⚠️ Το τρίτο έγραφε **ΑΛΛΟ μήνυμα** (*«Missing companyId for transmittal
 * issuance»*) ⇒ ο κριτής **δεν το έπιανε καθόλου**: ακριβώς ο λόγος που η
 * ταυτότητα δεν επιτρέπεται να είναι πρόθεμα συμβολοσειράς.
 *
 * 🔑 **ΔΥΟ ΚΛΑΔΟΙ, ΔΥΟ ΞΕΧΩΡΙΣΤΕΣ ΔΟΥΛΕΙΕΣ** — ποτέ δύο απαντήσεις στο ίδιο:
 *   1. **ταυτότητα** — το brand `isMissingTenant`. **Υπερσύνολο** του
 *      `instanceof`: κάθε `MissingTenantError` το φέρει, και επιπλέον επιβιώνει
 *      όταν το module φορτωθεί σε **δεύτερο γράφο** (Server ≠ Client, ADR-744
 *      §15), όπου το `instanceof` απαντά **ψευδώς `false`**. Ένας κλάδος
 *      `instanceof` **δίπλα** σε αυτόν θα ήταν γνήσιο υποσύνολο, δηλαδή δεύτερη
 *      απάντηση στο ίδιο ερώτημα (ADR-749 σε μικρογραφία).
 *   2. **δίχτυ κειμένου** — σύγκριση με την **εξαγόμενη σταθερά**, για ωμό
 *      `Error` με το κανονικό μήνυμα. **Πληθυσμός σήμερα: 0** (μετρημένο).
 *      ⚠️ **ΜΗΝ το διαγράψεις επειδή είναι μηδέν**: κλειδώνει την κατάσταση
 *      **πριν** ξαναεμφανιστεί (πρότυπο `Κ1` του CHECK 3.43) — και ήταν
 *      **1 στα 4** πριν τη μετανάστευση, δηλαδή «καθαρός επειδή δεν κοίταξε».
 */
export function isMissingTenantError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { isMissingTenant?: unknown }).isMissingTenant === true
  ) {
    return true;
  }
  return error instanceof Error && error.message === MISSING_TENANT_MESSAGE;
}

/**
 * Extracts tenant-aware authentication context from the current Firebase user.
 *
 * - Reads `companyId` and `globalRole` from custom claims (set via Firebase Admin SDK)
 * - Super admins (`globalRole === 'super_admin'`) may operate without a companyId
 * - Regular users without a companyId are rejected
 *
 * @throws {Error} If the user is not authenticated
 * @throws {Error} If a non-super-admin user has no companyId claim
 * @returns Promise resolving to TenantContext
 */
export async function requireAuthContext(): Promise<TenantContext> {
  // Wait for Firebase Auth to finish initializing (handles SSR/hydration race)
  // — early-mounted consumers (NotificationDrawer, opportunities, navigation) hit
  // requireAuthContext before AuthContext finishes wiring; without this gate they
  // throw AUTHENTICATION_ERROR even though the user IS logged in.
  if (!auth.currentUser) {
    await waitForAuthReady();
  }

  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('AUTHENTICATION_ERROR: User must be logged in');
  }

  const tokenResult = await currentUser.getIdTokenResult();
  const companyId = (tokenResult.claims?.companyId as string | undefined) ?? null;
  const globalRole = tokenResult.claims?.globalRole as string | undefined;
  const isSuperAdmin = globalRole === 'super_admin';

  if (!companyId && !isSuperAdmin) {
    throw new MissingTenantError();
  }

  const effectiveCompanyId = isSuperAdmin
    ? getSuperAdminActiveCompanyId()
    : null;

  return {
    uid: currentUser.uid,
    companyId,
    isSuperAdmin,
    effectiveCompanyId,
  };
}

/**
 * Resolves the effective companyId to filter client-side Firestore queries by.
 *
 * - Regular user → `ctx.companyId` (their tenant)
 * - Super admin WITH active switcher selection → `ctx.effectiveCompanyId`
 *   (impersonated tenant)
 * - Super admin WITHOUT switcher selection → `null` (cross-tenant view, the
 *   caller should skip the `where('companyId', ...)` constraint)
 *
 * ADR-356 SSOT: every custom service that does direct Firestore queries
 * outside `firestoreQueryService.subscribe` / `.getAll` MUST resolve its
 * tenant filter through this helper so the super-admin switcher (ADR-354)
 * is honored consistently. Without it, super-admin sessions read the
 * JWT-claim companyId and leak cross-tenant data.
 */
export function resolveEffectiveCompanyId(ctx: TenantContext): string | null {
  if (ctx.isSuperAdmin) return ctx.effectiveCompanyId;
  return ctx.companyId;
}
