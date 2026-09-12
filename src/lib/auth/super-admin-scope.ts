/**
 * Super Admin Project Scope — SSOT (ADR-356)
 *
 * Canonical decision function for super-admin-aware API routes that need to
 * pick:
 *   1. which `companyId` to filter Firestore by (or skip the filter),
 *   2. which cache slot to use so different effective tenants never collide.
 *
 * Every project-data route that previously branched on `ctx.globalRole === 'super_admin'`
 * + `ctx.superAdminOverride` should delegate to `resolveSuperAdminProjectScope(ctx)`
 * to avoid divergent implementations of the same rule.
 */

import type { AuthContext } from './types';
// 🔑 Ο ΕΝΑΣ φρουρός «ο ιδιωτικός χώρος δεν γίνεται εμβέλεια ερωτήματος» — κοινός με το
//    δόγμα του ADR-702. ⛔ ΜΗΝ τον ξαναγράψεις εδώ: δύο αντίγραφα αποκλίνουν σιωπηλά (N.18).
import { assertQueryableWorkspace } from './tenant-scope';

export type SuperAdminScopeMode =
  | 'tenant' // regular user OR super-admin defaulting to their JWT companyId
  | 'super-admin-global' // super admin whose request named NO company at all
  /**
   * Super admin acting inside **one named** company.
   *
   * 🔴 **ΛΕΓΟΤΑΝ `super-admin-impersonate` ΚΑΙ ΤΟ ΟΝΟΜΑ ΗΤΑΝ ΛΑΘΟΣ** (2026-09-12): η
   * κατάσταση δεν είναι «υποδύεται άλλον» — είναι «**το αίτημα ονόμασε εταιρεία**». Και
   * το παλιό όνομα έκρυβε ακριβώς το κενό: όταν ο super-admin βρίσκεται στο **δικό του**
   * `/o/<εταιρεία>`, δεν υποδύεται κανέναν, οπότε ο παλιός έλεγχος
   * (`superAdminOverride`, αληθής **μόνο** σε διαφορά από το claim) απαντούσε «όχι» και
   * η διαδρομή έδινε **καθολική όψη όλων των εταιρειών** κάτω από διεύθυνση που ονομάζει
   * **μία**.
   */
  | 'super-admin-scoped';

export interface SuperAdminProjectScope {
  /**
   * The companyId to use in a `where('companyId', '==', ...)` Firestore filter.
   * `null` means "no filter" — emitted only for `super-admin-global`, the
   * cross-tenant view a super admin sees when nothing is selected.
   */
  readonly filterCompanyId: string | null;
  /**
   * Cache-key suffix. Combined with a per-route prefix it yields a unique
   * cache slot per effective tenant — switching A → B → A in the UI never
   * serves the other tenant's cached payload.
   */
  readonly cacheSlot: string;
  /** Discriminator for logging / route-side branching. */
  readonly mode: SuperAdminScopeMode;
}

/**
 * **«Ονόμασε αυτό το αίτημα εταιρεία;»** — η ερώτηση που έλειπε (ADR-787 §5.3 ζ όριο 1).
 *
 * 🔴 **ΤΟ `superAdminOverride` ΔΕΝ ΕΙΝΑΙ ΑΥΤΗ Η ΕΡΩΤΗΣΗ.** Είναι αληθές **μόνο** όταν ο
 * δηλωμένος χώρος **διαφέρει** από το claim — δηλαδή απαντά *«άλλαξε εταιρεία;»*. Ο
 * super-admin μέσα στο **δικό του** γραφείο έδινε `false`, και η απάντηση γινόταν
 * **καθολική όψη**: μετρημένο στον κώδικα, `/o/<δική του>/projects` φιλτράριζε **τίποτα**.
 *
 * ⚠️ **Ο παλιός έλεγχος μένει μέσα στη διάζευξη, ΔΕΝ αντικαθίσταται**: υπάρχουν αιτήματα
 * που φτάνουν με την **αποσυρόμενη** κεφαλίδα (παλιό πακέτο σε ανοιχτή καρτέλα, Φάση Β) —
 * εκεί το `requestedWorkspace` υπάρχει επίσης, αλλά η διάζευξη κρατά τη συμπεριφορά
 * **ταυτόσημη** και για contexts που δεν γεννήθηκαν από αίτημα HTTP (κατασκευασμένος dev
 * principal, εσωτερικές κλήσεις υπηρεσιών) όπου το πεδίο λείπει **νόμιμα**.
 */
function namesOneCompany(ctx: AuthContext): boolean {
  return ctx.superAdminOverride === true || ctx.requestedWorkspace?.kind === 'org';
}

export function resolveSuperAdminProjectScope(ctx: AuthContext): SuperAdminProjectScope {
  // 🔴 Δεύτερη γραμμή άμυνας: ο ιδιωτικός χώρος **δεν** επιτρέπεται να καταλήξει σε
  //    `filterCompanyId: null`, που εδώ σημαίνει «ΟΛΗ η συλλογή» — η ίδια η διαρροή.
  assertQueryableWorkspace(ctx);

  if (ctx.globalRole === 'super_admin' && namesOneCompany(ctx)) {
    return {
      filterCompanyId: ctx.companyId,
      cacheSlot: `super:${ctx.companyId}`,
      mode: 'super-admin-scoped',
    };
  }
  if (ctx.globalRole === 'super_admin') {
    return {
      filterCompanyId: null,
      cacheSlot: 'all',
      mode: 'super-admin-global',
    };
  }
  return {
    filterCompanyId: ctx.companyId,
    cacheSlot: `tenant:${ctx.companyId}`,
    mode: 'tenant',
  };
}
