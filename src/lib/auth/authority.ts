/**
 * =============================================================================
 * Ο ΚΡΙΤΗΣ ΤΗΣ ΕΞΟΥΣΙΟΔΟΤΗΣΗΣ — ο ΕΝΑΣ (ADR-801 §4)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Επιτρέπεται σε **ΑΥΤΟΝ** τον άνθρωπο **ΑΥΤΗ** η πράξη;»*
 * **Ο απαντητής**: αυτό το αρχείο. Κανένα άλλο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ — ΕΞΙ ΑΠΑΝΤΗΤΕΣ, ΜΕΤΡΗΜΕΝΟΙ ΣΤΟ ΔΕΝΤΡΟ (2026-08-24)
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. `lib/auth/types.ts` GLOBAL_ROLES ........... ✅ η αυθεντία (claims)
 *   2. `EnterpriseSecurityService.checkUserRole` ... 🔴 λίστα email, ΣΤΟΝ ΠΕΛΑΤΗ
 *   3. `server/admin/admin-guards.ts:158` ......... 🔴 λίστα email, ΣΤΟΝ SERVER
 *   4. `lib/auth/security-policy.ts:24` ........... 🔴 ['admin','broker','builder']
 *   5. `BimCommentDetailsPanel.tsx:25` ............ 🔴 inline Set
 *   6. `CustomDictionaryManager.tsx:41` ........... 🔴 inline Set
 *
 * Έξι σύνολα τιμών, **κανένα ταυτόσημο με άλλο**. Το σχήμα του ADR-749, σε
 * μονοπάτι **εξουσιοδότησης**.
 *
 * ⚠️ **ΤΟ ΣΧΟΛΙΟ ΕΛΕΓΕ ΨΕΜΑΤΑ, ΚΑΙ ΓΙ' ΑΥΤΟ ΧΡΕΙΑΖΕΤΑΙ ΠΥΛΗ.** Το docblock του
 * `UserRoleContext.tsx` γράφει *«Database-driven role management (**no hardcoded
 * admin emails!**)»* — και ο κώδικας δέκα γραμμές παρακάτω διαβάζει ακριβώς
 * λίστα email. Η **περιγραφή της διόρθωσης ΗΤΑΝ η απόκλιση**: ίδιο σχήμα με τις
 * δύο λίστες namespace του CHECK 3.34 (είχαν αποκλίνει κατά **63**), τη λίστα
 * 18-vs-26 του 3.37, και το 19/20 του 3.57. **Ανάθεση σε άνθρωπο που πρέπει να
 * θυμάται δεν είναι φρουρός** (μάθημα 3.36: *ένα anchor χωρίς gate είναι σχόλιο*).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏛️ ΤΟ ΠΡΟΤΥΠΟ — ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ίδιο σχήμα με τον αδελφό απαντητή `decideMembership` (ADR-787 §5.1): ρητές
 * ετυμηγορίες · deny-by-default · η ταυτότητα του ερωτήματος επιστρέφεται μαζί
 * με την απάντηση. Οι πηγές δεδομένων είναι **υπάρχουσες SSoT** — `PERMISSIONS`
 * και `PREDEFINED_ROLES`. **Κανένας νέος πίνακας ρόλων** (θα ήταν ο έβδομος).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΚΡΙΣΗΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΥΛΟΠΟΙΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. άγνωστη **ικανότητα**  ⇒ ⛔ (ΠΡΙΝ ακόμα και από το bypass — βλ. §Κ1)
 *   2. καμία **ταυτότητα**    ⇒ ⛔
 *   3. άγνωστος **ρόλος**     ⇒ ⛔ (fail-closed: ταυτότητα που δεν καταλαβαίνω)
 *   4. `isBypass`             ⇒ ✅
 *   5. ρητό **permission**    ⇒ ✅
 *   6. permission **του ρόλου** ⇒ ✅
 *   7. τίποτα από τα παραπάνω ⇒ ⛔ `denied-insufficient`
 *
 * ⚠️ **ΓΙΑΤΙ ΤΟ (3) ΠΡΙΝ ΤΟ (5)**: αν ο ρόλος είναι εκτός λεξιλογίου, η
 * ταυτότητα **δεν είναι κατανοητή**. Ένα ρητό permission πάνω σε ακατανόητη
 * ταυτότητα θα ήταν «ναι» που κανείς δεν μπορεί να εξηγήσει. Μετρημένα ζωντανό:
 * `users/dev-admin` φέρει `globalRole: 'admin'`.
 *
 * @module lib/auth/authority
 * @enterprise ADR-801 — Ένας κριτής για το «επιτρέπεται;»
 * @see ADR-787 §5.1 — ο αδελφός («είναι μέλος;»)
 * @see CHECK 3.68 — η πύλη που κάνει τον δεύτερο κριτή αδύνατο
 */

import { PERMISSIONS, type PermissionId } from './types';
import { PREDEFINED_ROLES, getRolePermissions, isRoleBypass } from './roles';

import type {
  CapabilityDecision,
  CapabilityQuery,
  CapabilitySubject,
  CapabilityVerdict,
} from '@/types/capability-authority';

// =============================================================================
// ΟΙ ΛΟΓΟΙ — ΠΛΗΡΟΤΗΤΑ ΕΠΙΒΑΛΛΟΜΕΝΗ ΑΠΟ ΤΟΝ ΜΕΤΑΓΛΩΤΤΙΣΤΗ
// =============================================================================

/**
 * Κλειδί i18n ανά ετυμηγορία — `null` για όσες **επιτρέπουν**.
 *
 * 🔑 **`Record<CapabilityVerdict, …>` και ΟΧΙ χάρτης μερικών κλειδιών**: έτσι
 * μια **όγδοη** ετυμηγορία **δεν μεταγλωττίζεται** μέχρι να αποκτήσει λόγο.
 * Ένας φρουρός που προστίθεται χωρίς εξήγηση είναι άρνηση που ο χρήστης βλέπει
 * ως κενή οθόνη.
 *
 * ⚠️ Τα κλειδιά **δεν υπάρχουν ακόμη στα locales**, και είναι σκόπιμο: κανένα UI
 * δεν τα καταναλώνει στη Φάση 1. Μπαίνουν στη Φάση 3 μαζί με τον πρώτο
 * καταναλωτή — μεταφράσεις που δεν ζητά κανείς είναι νεκρό βάρος (N.11 · 3.8).
 */
const REASON_BY_VERDICT: Record<CapabilityVerdict, string | null> = {
  'granted-by-bypass': null,
  'granted-by-permission': null,
  'granted-by-role': null,
  'denied-unauthenticated': 'auth:capability.denyReason.notAuthenticated',
  'denied-insufficient': 'auth:capability.denyReason.insufficient',
  'denied-unknown-role': 'auth:capability.denyReason.unknownRole',
  'denied-unknown-action': 'auth:capability.denyReason.unknownAction',
};

// =============================================================================
// ΒΟΗΘΟΙ — καθαροί, ένα ερώτημα ο καθένας
// =============================================================================

/**
 * Υπάρχει αυτή η ικανότητα στο μητρώο;
 *
 * ⚠️ `Object.hasOwn` και **όχι** `in`: το `in` απαντά `true` για `'toString'`,
 * δηλαδή κάθε ιδιότητα του prototype θα περνούσε για έγκυρη ικανότητα.
 */
function isKnownAction(action: string): action is PermissionId {
  return Object.hasOwn(PERMISSIONS, action);
}

/**
 * Ο ρόλος, κανονικοποιημένος — **κενή συμβολοσειρά = απουσία**.
 *
 * ⚠️ Πρότυπο `extractCustomClaims` / `landing.ts`: το `companyId.length === 0`
 * απορρίπτεται fail-closed ως *«δεν είναι ταυτότητα που μπορούμε να
 * εξουσιοδοτήσουμε»*. Το ίδιο ισχύει για τον ρόλο — αλλιώς ένα `''` θα
 * κατέληγε `denied-unknown-role`, δηλαδή θα ανέφερε **σφάλμα δεδομένων** εκεί
 * που υπάρχει απλώς **απουσία ρόλου** (νόμιμη κατάσταση: ο ιδιώτης).
 */
function normalizeRole(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Είναι ο ρόλος μέσα στο λεξιλόγιο που ξέρει να απαντήσει ο κριτής; */
function isKnownRole(role: string): boolean {
  return Object.hasOwn(PREDEFINED_ROLES, role);
}

/** Έχει το claim `permissions` **ρητά** αυτή την ικανότητα; */
function hasExplicitPermission(
  subject: CapabilitySubject,
  action: PermissionId,
): boolean {
  const granted = subject.permissions;
  return Array.isArray(granted) && granted.includes(action);
}

/** Δίνει ο ρόλος αυτή την ικανότητα, μέσω `PREDEFINED_ROLES`; */
function roleGrants(role: string, action: PermissionId): boolean {
  return getRolePermissions(role).includes(action);
}

/** Συσκευασία ετυμηγορίας σε απόφαση — **ένα** σημείο, ώστε ο λόγος να μη ξεχνιέται. */
function decide(verdict: CapabilityVerdict, action: PermissionId): CapabilityDecision {
  return { verdict, action, reason: REASON_BY_VERDICT[verdict] };
}

// =============================================================================
// Ο ΚΡΙΤΗΣ
// =============================================================================

/**
 * **Επιτρέπεται σε αυτόν τον άνθρωπο αυτή η πράξη;**
 *
 * @param query Ταυτότητα **ήδη επαληθευμένη** (claims) × η ικανότητα.
 * @returns Μία από τις **επτά** ετυμηγορίες, ποτέ `boolean`, ποτέ σιωπή.
 *
 * @example
 * const d = decideCapability({ subject: user, action: 'admin_access' });
 * if (!isGranted(d.verdict)) showDenied(d.reason);
 */
export function decideCapability(query: CapabilityQuery): CapabilityDecision {
  const { subject, action } = query;

  // (1) Άγνωστη ικανότητα ⇒ ⛔ ΓΙΑ ΟΛΟΥΣ, bypass συμπεριλαμβανομένου.
  //
  // 🔑 Αν το τυπογραφικό `'dfx:view'` περνούσε για τον super_admin, θα δούλευε
  //    ακριβώς για όποιον μπορεί να το διορθώσει και θα απέτυχε για όλους τους
  //    άλλους — σφάλμα που κρύβεται από αυτόν που το έγραψε.
  if (!isKnownAction(action)) return decide('denied-unknown-action', action);

  // (2) Καμία ταυτότητα ⇒ ⛔ (deny-by-default, OWASP).
  if (!subject) return decide('denied-unauthenticated', action);

  const role = normalizeRole(subject.globalRole);

  // (3) Ρόλος εκτός λεξιλογίου ⇒ ⛔ fail-closed.
  //     ⚠️ Απουσία ρόλου (`null`) ΔΕΝ είναι εδώ: είναι νόμιμη κατάσταση.
  if (role !== null && !isKnownRole(role)) {
    return decide('denied-unknown-role', action);
  }

  // (4) Ο ρόλος παρακάμπτει κάθε έλεγχο.
  //     ⚠️ `roles.ts:55` → `super_admin: { permissions: [], isBypass: true }`.
  //     Χωρίς αυτόν τον κλάδο ο υπερδιαχειριστής δεν θα είχε **καμία** ικανότητα.
  if (role !== null && isRoleBypass(role)) {
    return decide('granted-by-bypass', action);
  }

  // (5) Ρητά δοσμένο permission στο claim.
  if (hasExplicitPermission(subject, action)) {
    return decide('granted-by-permission', action);
  }

  // (6) Το δίνει ο ρόλος.
  if (role !== null && roleGrants(role, action)) {
    return decide('granted-by-role', action);
  }

  // (7) Η κανονική άρνηση.
  return decide('denied-insufficient', action);
}
