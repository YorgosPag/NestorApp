/**
 * =============================================================================
 * ΟΙ ΙΚΑΝΟΤΗΤΕΣ ΚΕΙΜΕΝΟΥ ΤΟΥ DXF — **ΠΡΟΒΟΛΗ**, ΟΧΙ ΚΡΙΤΗΣ (ADR-801 Φάση 3)
 * =============================================================================
 *
 * Μεταφράζει τις ετυμηγορίες του **ΕΝΟΣ** κριτή (`lib/auth/authority.ts`) στο
 * σχήμα που καταναλώνει η γραμμή εργαλείων κειμένου. **Καμία απόφαση εδώ.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΤΕΣΤΗΣΕ — ΠΙΝΑΚΑΣ 13 ΡΟΛΩΝ ΠΟΥ ΔΕΝ ΜΠΟΡΟΥΣΕ ΝΑ ΠΥΡΟΔΟΤΗΣΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι 2026-08-25 εδώ ζούσε `switch (role)` σε **13** ρόλους
 * (`architect`·`engineer`·`project_manager`·`site_manager`·`foreman`·`client`…),
 * και τον τροφοδοτούσε:
 *
 *     useCanEditText.ts → capabilitiesForRole( useUserRole().user?.role )
 *
 * Το `user.role` έχει τύπο **`'admin' | 'authenticated' | 'public'`** και
 * παράγεται από **λίστα email** μέσα στο bundle του φυλλομετρητή
 * (`EnterpriseSecurityService.checkUserRole` → `NEXT_PUBLIC_ADMIN_EMAILS`).
 *
 * ⇒ `'authenticated'` έπεφτε στο `default` → **`NONE`**. Δηλαδή **κάθε
 *   πραγματικός `company_admin` και `super_admin` έπαιρνε ΜΗΔΕΝ δικαιώματα**
 *   στην επεξεργασία κειμένου, και **μόνο** όποιος ήταν γραμμένος στη λίστα
 *   email έπαιρνε `FULL`. **10 από τους 13** κλάδους ήταν **δομικά νεκροί**.
 *
 * ⚠️ **ΚΑΙ ΤΑ 11 TESTS ΤΟΥ ΗΤΑΝ ΠΡΑΣΙΝΑ**: καλούσαν την καθαρή συνάρτηση
 * **απευθείας** με `'architect'` — τιμή που **κανείς δεν παράγει**. *Ο
 * παρονομαστής έλειπε.* Γι' αυτό το σημερινό test αρχίζει με **άγκυρα
 * παρονομαστή** που κρίνει **μόνο** τιμές τις οποίες η ζωντανή διαδρομή μπορεί
 * να γεννήσει (`GLOBAL_ROLES`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ — Ο ΑΡΧΙΤΕΚΤΟΝΑΣ **ΔΕΝ** ΘΕΡΑΠΕΥΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τα `architect`·`engineer`·`project_manager`·`site_manager` **δεν είναι
 * καθολικοί ρόλοι**: το `GLOBAL_ROLES` έχει **τέσσερις** τιμές
 * (`super_admin`·`company_admin`·`internal_user`·`external_user`) και ο
 * `claims-handler` απορρίπτει καθετί άλλο με `isValidGlobalRole`. Είναι
 * **ρόλοι έργου** (`projects/{id}/members/{uid}.roleId`), άρα η ικανότητά τους
 * απαντιέται **ανά έργο** — ερώτημα με `resource`, που ο κριτής **δηλωμένα**
 * δεν έχει ακόμη (ADR-801 §7) και που ο server ήδη απαντά μέσω του
 * `checkPermission(ctx, action, { projectId })`.
 *
 * ⇒ Το μετρημένο κέρδος αυτής της αλλαγής είναι: **ο `super_admin` και ο
 *   `company_admin` παύουν να παίρνουν `NONE`**, και μια **ρητή** παραχώρηση
 *   στο claim `permissions` πιάνει τόπο. Ο αρχιτέκτονας θέλει τη διάσταση
 *   `resource` — **δεν** το «λύνουμε» ξαναγράφοντας πίνακα ρόλων εδώ.
 *
 * @module subapps/dxf-viewer/hooks/text-edit-capabilities
 * @enterprise ADR-801 §4 — ο ΕΝΑΣ κριτής · ADR-344 Q8 — η γραμμή εργαλείων
 */

import { decideCapability } from '@/lib/auth/authority';
import type { PermissionId } from '@/lib/auth/types';
import {
  isGranted,
  type CapabilityDecision,
  type CapabilitySubject,
} from '@/types/capability-authority';

// =============================================================================
// ΤΟ ΣΧΗΜΑ ΠΟΥ ΒΛΕΠΕΙ ΤΟ UI
// =============================================================================

export interface TextEditCapabilities {
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly canUnlockLayer: boolean;
  /** Κλειδί i18n για το «γιατί όχι»· `null` όταν η επεξεργασία επιτρέπεται. */
  readonly denyReason: string | null;
}

/**
 * Ποια **ικανότητα του μητρώου** στέκεται πίσω από κάθε κουμπί.
 *
 * ⚠️ Αυτό **δεν** είναι πίνακας ρόλων — είναι η αντιστοίχιση *χειρονομία UI →
 * `PermissionId`*, δηλαδή ακριβώς η δουλειά ενός PEP. Ποιος ρόλος παίρνει την
 * καθεμία το λέει **μόνο** το `PREDEFINED_ROLES`.
 *
 * ⚠️ **ΜΗΝ γράψεις εδώ ρόλο.** Αν χρειάζεται νέος συνδυασμός δικαιωμάτων, η
 * αλλαγή ανήκει στο `lib/auth/roles.ts` — αλλιώς γεννιέται ο **δεύτερος**
 * κριτής, που είναι όλο το νόημα του ADR-801.
 */
export const TEXT_EDIT_ACTIONS = {
  canCreate: 'dxf:text:create',
  canEdit: 'dxf:text:edit',
  canDelete: 'dxf:text:delete',
  canUnlockLayer: 'dxf:layers:unlock',
} as const satisfies Readonly<Record<string, PermissionId>>;

/** Οι **τέσσερις** ικανότητες που αφορούν τη γραμμή εργαλείων — τίποτα άλλο. */
export type TextEditAction = (typeof TEXT_EDIT_ACTIONS)[keyof typeof TEXT_EDIT_ACTIONS];

/** Οι πύλες που χρειάζεται η γραμμή εργαλείων, ως πίνακας για τα άγκιστρα. */
export const TEXT_EDIT_PERMISSIONS: readonly TextEditAction[] =
  Object.values(TEXT_EDIT_ACTIONS);

/** Η ικανότητα που ορίζει το «γιατί όχι» — η **επεξεργασία** είναι η κύρια πράξη. */
export const TEXT_EDIT_PRIMARY_ACTION: TextEditAction = TEXT_EDIT_ACTIONS.canEdit;

// =============================================================================
// Η ΠΡΟΒΟΛΗ
// =============================================================================

/** Ελάχιστο σχήμα ετυμηγορίας — δέχεται και τις πύλες του PEP (`CapabilityGate`). */
type DecisionLike = Pick<CapabilityDecision, 'verdict' | 'reason'>;

/**
 * Οι τέσσερις ετυμηγορίες → το σχήμα του UI.
 *
 * ⚠️ Ο `denyReason` βγαίνει από την **κύρια** πράξη και **μόνο** από αυτήν.
 * Αλλιώς ένας `site_manager` — που **μπορεί** να γράψει αλλά **δεν** μπορεί να
 * σβήσει — θα έβλεπε μόνιμα μήνυμα άρνησης πάνω σε εργαλείο που **δουλεύει**.
 *
 * ⚠️ Το κλειδί έρχεται **από τον κριτή** (`auth:capability.denyReason.*`) και
 * δεν ξαναγράφεται εδώ: δεύτερο λεξιλόγιο λόγων θα αποκλίνει σιωπηλά, όπως οι
 * δύο λίστες namespace του CHECK 3.34 (είχαν αποκλίνει κατά **63**).
 */
export function capabilitiesFromDecisions(
  decisions: Readonly<Record<TextEditAction, DecisionLike>>,
): TextEditCapabilities {
  const allowed = (action: TextEditAction): boolean =>
    isGranted(decisions[action].verdict);

  const primary = decisions[TEXT_EDIT_PRIMARY_ACTION];

  return {
    canCreate: allowed(TEXT_EDIT_ACTIONS.canCreate),
    canEdit: allowed(TEXT_EDIT_ACTIONS.canEdit),
    canDelete: allowed(TEXT_EDIT_ACTIONS.canDelete),
    canUnlockLayer: allowed(TEXT_EDIT_ACTIONS.canUnlockLayer),
    denyReason: isGranted(primary.verdict) ? null : primary.reason,
  };
}

/**
 * Οι ικανότητες κειμένου για μια **ήδη επαληθευμένη** ταυτότητα.
 *
 * Καθαρή και **χωρίς React**, ώστε οι άγκυρες να διατρέχουν κάθε παραγώγιμη
 * ταυτότητα χωρίς πάροχο — αλλά πλέον με τον **ίδιο** κριτή που τρέχει ζωντανά.
 */
export function capabilitiesForSubject(
  subject: CapabilitySubject | null,
): TextEditCapabilities {
  const decisions = {} as Record<TextEditAction, DecisionLike>;
  for (const action of TEXT_EDIT_PERMISSIONS) {
    decisions[action] = decideCapability({ subject, action });
  }
  return capabilitiesFromDecisions(decisions);
}
