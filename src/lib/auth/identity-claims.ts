/**
 * =============================================================================
 * Ο ΕΝΑΣ ΤΑΞΙΝΟΜΗΤΗΣ ΤΩΝ CLAIMS ΤΑΥΤΟΤΗΤΑΣ (ADR-817 §11 · ADR-853 §14)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Τι λέει αυτό το token για το **ποιος** είναι και **πού** ανήκει;»*
 * **Ο απαντητής**: αυτό το αρχείο. Κανένα άλλο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — «ΑΠΩΝ» ΔΙΑΒΑΖΟΤΑΝ ΩΣ «ΑΚΥΡΟΣ» (μετρημένο ζωντανά 2026-09-13)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο νέος άνθρωπος συνδέεται και **δεν** παίρνει claim ρόλου (ADR-853 Φ1: η σύνδεση γράφει
 * μόνο ταυτότητα). Οι **δύο** παραγωγοί ταυτότητας του server έκριναν
 * `typeof globalRole !== 'string' || !isValidGlobalRole(...)` ⇒ **απόρριψη** — δηλαδή
 * *«δεν σου έδωσε ποτέ κανείς ρόλο»* έβγαινε ίδιο με *«cookie που δεν εμπιστευόμαστε»*.
 * Αποτέλεσμα: **κυκλική εξάρτηση** — για να αποδεχτείς πρόσκληση χρειαζόσουν ρόλο, και τον
 * ρόλο τον έδινε η αποδοχή. Κλειστές ήταν και οι **14** διαδρομές προσωπικής εμβέλειας,
 * μαζί η **ίδρυση δικού σου χώρου**.
 *
 * ⚠️ **ΚΑΙ Η ΣΩΣΤΗ ΣΗΜΑΣΙΟΛΟΓΙΑ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΗ — ΣΕ ΤΡΙΑ ΑΛΛΑ ΣΗΜΕΙΑ**:
 * `authority.ts` (*«απουσία ρόλου … νόμιμη κατάσταση»*) · `identity-provenance.ts` ·
 * `useCapability` Π3. Ο πελάτης και ο PDP έλεγαν «νόμιμο», ο server «άκυρο» — σκορπισμένη
 * αυθεντία (ADR-749), **ένας όροφο πιο πάνω** από το ADR-807 (`companyId`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΠΙΝΑΚΑΣ — ΑΛΛΑΞΕ ΕΝΑ ΚΕΛΙ, ΚΑΙ ΜΟΝΟ ΕΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * | ρόλος στο token | `companyId` | ετυμηγορία |
 * |---|---|---|
 * | έγκυρος | ναι | `organization` |
 * | έγκυρος | όχι | `personal` |
 * | **άκυρος** | οτιδήποτε | `rejected: invalid-role` — **συμβόλαιο ADR-807 §3.4β** |
 * | **απών** | ναι | `rejected: workspace-without-role` — εταιρεία χωρίς ρόλο = ασυνεπές claim |
 * | **απών** | όχι | 🔑 `personal` με `globalRole: null` — **ΤΟ ΝΕΟ ΚΕΛΙ** |
 *
 * 🏆 **Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΚΑΙ ΠΟΥ ΤΗΝ ΞΕΠΕΡΝΑΜΕ**: στο Auth0 Organizations ο ρόλος
 * της πρόσκλησης είναι **προαιρετικός**· στο Figma η αποδοχή θέλει **λογαριασμό**, όχι
 * δικαίωμα· το OWASP χωρίζει ρητά αυθεντικοποίηση από εξουσιοδότηση (απών ρόλος = **καμία
 * ικανότητα**, όχι **καμία ταυτότητα**). Όλοι όμως αφήνουν την απουσία **σιωπηλή** και
 * ελπίζουν ότι η εφαρμογή θα την ελέγξει. Εδώ είναι **ονομασμένη κατάσταση** σε διακριτή
 * ένωση: ο μεταγλωττιστής **δεν επιτρέπει** να αγνοηθεί, και ο κανόνας γράφεται **μία** φορά.
 *
 * ⚠️ **ΔΕΝ είναι κριτής** (CHECK 3.68): δεν ονομάζει ρόλο, δεν απαντά «επιτρέπεται;».
 * Απαντά *«τι γράφει το token;»*· την εξουσιοδότηση την κρίνουν `decideCapability` /
 * `checkPermission` / `withAuth`. Ισόμορφο — **κανένα** `server-only` (πρότυπο
 * `claim-permissions.ts`): ο κανόνας απουσίας τον χρειάζεται και ο πελάτης.
 *
 * @module lib/auth/identity-claims
 * @see lib/auth/auth-context.ts   — παραγωγός #1 (σύνορο API)
 * @see server/auth/page-identity.ts — παραγωγός #2 (Server Components)
 */

import { isValidGlobalRole, type GlobalRole } from './types';

// =============================================================================
// Ο ΡΟΛΟΣ — ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ
// =============================================================================

/** Τι γράφει το claim `globalRole` — **ποτέ** boolean. */
export type GlobalRoleClaim =
  | { readonly kind: 'assigned'; readonly role: GlobalRole }
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid' };

/**
 * **Είναι αυτό απουσία ρόλου;** — ο κανόνας, **μία φορά**.
 *
 * `undefined` · `null` · κενή/λευκή συμβολοσειρά ⇒ **απουσία**. Πρότυπο ADR-657 §3.5 για το
 * `companyId` (*«κενή συμβολοσειρά = απουσία»*) και το `normalizeRole` του κριτή.
 *
 * ⛔ **Μη-συμβολοσειρά (`42`, `{}`, `[]`) ΔΕΝ είναι απουσία**: είναι τιμή που **δεν
 *    καταλαβαίνουμε**. Αν γινόταν «απών», ένα αλλοιωμένο claim θα έβγαινε νόμιμος πολίτης
 *    αντί για απόρριψη — δηλαδή η διόρθωση θα **χαλάρωνε την ασφάλεια σιωπηλά**.
 */
export function isAbsentRoleClaim(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  return typeof raw === 'string' && raw.trim().length === 0;
}

/** Η τιμή του claim `globalRole`, ταξινομημένη. */
export function readGlobalRoleClaim(raw: unknown): GlobalRoleClaim {
  if (isAbsentRoleClaim(raw)) return { kind: 'absent' };
  // ⚠️ Χωρίς `trim` εδώ, επίτηδες: ένας **παρών** ρόλος πρέπει να είναι **ακριβώς** λέξη του
  //    λεξιλογίου. `' company_admin'` δεν το έγραψε κανένας γραφέας μας ⇒ δεν το εμπιστευόμαστε.
  if (typeof raw === 'string' && isValidGlobalRole(raw)) return { kind: 'assigned', role: raw };
  return { kind: 'invalid' };
}

// =============================================================================
// Η ΤΑΥΤΟΤΗΤΑ — ΡΟΛΟΣ × ΧΩΡΟΣ
// =============================================================================

/** Ό,τι χρειάζεται ο ταξινομητής από το token — `DecodedIdToken` το ικανοποιεί. */
export interface IdentityClaimsInput {
  readonly globalRole?: unknown;
  readonly companyId?: unknown;
}

/**
 * Γιατί τα claims **δεν** δίνουν ταυτότητα που μπορεί να εξουσιοδοτηθεί.
 *
 * - `invalid-role` — ρόλος **παρών** αλλά εκτός λεξιλογίου (ή μη-συμβολοσειρά).
 * - `workspace-without-role` — `companyId` **χωρίς** ρόλο. Κανένας γραφέας μας δεν το
 *   παράγει (`composeClaimPayload` γράφει πάντα και τα δύο)· αν εμφανιστεί, το claim είναι
 *   **ασυνεπές**. ⛔ ΜΗΝ το υποβιβάσεις σε `personal`: θα **πετούσε σιωπηλά** μισθωτή.
 */
export type IdentityClaimsRejection = 'invalid-role' | 'workspace-without-role';

export type IdentityClaimsVerdict =
  | { readonly kind: 'organization'; readonly globalRole: GlobalRole; readonly companyId: string }
  | { readonly kind: 'personal'; readonly globalRole: GlobalRole | null }
  | { readonly kind: 'rejected'; readonly why: IdentityClaimsRejection };

/**
 * **Ο πίνακας της κεφαλίδας**, ως κώδικας — ο ΕΝΑΣ, για **και τους δύο** παραγωγούς.
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ** (ADR-807 §3.4β): ο **άκυρος** ρόλος απορρίπτεται **ΠΡΙΝ**
 *    κοιτάξουμε τον χώρο — αλλιώς token με άκυρο ρόλο και χωρίς `companyId` θα έβγαινε
 *    `personal`. Αλλάζει **μόνο** η μεταχείριση της **απουσίας**.
 *
 * ⚠️ Το `companyId` κρίνεται με τον κανόνα ADR-657 §3.5 (κενή = απουσία), τον ίδιο που
 *    ακολουθούν `lib/routes/landing.ts` και `hasOrganization`.
 */
export function classifyIdentityClaims(token: IdentityClaimsInput): IdentityClaimsVerdict {
  const role = readGlobalRoleClaim(token.globalRole);
  if (role.kind === 'invalid') return { kind: 'rejected', why: 'invalid-role' };

  const companyId = token.companyId;
  const hasWorkspace = typeof companyId === 'string' && companyId.length > 0;

  if (!hasWorkspace) {
    return { kind: 'personal', globalRole: role.kind === 'assigned' ? role.role : null };
  }
  if (role.kind === 'absent') return { kind: 'rejected', why: 'workspace-without-role' };

  return { kind: 'organization', globalRole: role.role, companyId };
}
