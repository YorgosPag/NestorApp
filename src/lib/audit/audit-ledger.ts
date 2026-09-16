/**
 * 📒 **ΣΕ ΠΟΙΟΥ ΤΟ ΒΙΒΛΙΟ ΓΡΑΦΕΤΑΙ ΜΙΑ ΕΓΓΡΑΦΗ ΙΣΤΟΡΙΚΟΥ** — ADR-195 §«Προσωπικό βιβλίο» · ADR-864 Φ1β
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-09-16 κάθε εγγραφή του `entity_audit_trail` έφερε **υποχρεωτικά**
 * `companyId`, και μόνο διαχειριστής εταιρείας τη διάβαζε. Ο ιδιώτης χωρίς εταιρεία
 * (ADR-864 Ε-1) **δεν μπορούσε να έχει ίχνος** — ούτε για την απόσυρση της αγγελίας του.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΑΠΑΝΤΗΣΗ — ΕΝΑ ΣΧΗΜΑ ΣΕ ΤΡΙΑ ΣΗΜΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η εμβέλεια είναι **διακριτή ένωση**, και το **ίδιο** σχήμα ισχύει στις παραμέτρους του
 * `recordChange`, στο αποθηκευμένο έγγραφο και στην ανάγνωση:
 *
 *   `{ companyId }` — βιβλίο **εταιρείας** (ό,τι ίσχυε πάντα)
 *   `{ userId }`    — **προσωπικό** βιβλίο ανθρώπου
 *
 * Τα ονόματα **δεν εφευρέθηκαν**: είναι τα μέλη του `WorkspaceRef`
 * (`types/workspace-membership.ts`), και το `userId` είναι ήδη το `fieldName` της λειτουργίας
 * `mode: 'userId'` του `tenant-config.ts` (π.χ. `NOTIFICATIONS`).
 *
 * ⚠️ **ΤΟ `userId` ΕΙΝΑΙ Ο ΚΑΤΟΧΟΣ ΤΟΥ ΒΙΒΛΙΟΥ, ΟΧΙ Ο ΔΡΑΣΤΗΣ.** Ο δράστης είναι το
 * `performedBy`. Σήμερα συμπίπτουν στην αγγελία ιδιώτη· **δεν** είναι το ίδιο ερώτημα.
 *
 * ⛔ **ΜΗΝ το ονομάσεις `ownerUserId`**: το ADR-777 §8.33 μετονόμασε ρητά ένα τέτοιο πεδίο,
 * επειδή το «owner» έδειχνε σε κάποιον που δεν κατέχει τίποτα.
 *
 * 🔴 **ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ, ΕΝΑ ΣΥΣΤΗΜΑ** ({@link AUDIT_LEDGER_COLLECTION}). Η πρώτη εκδοχή κρατούσε
 * και τα δύο βιβλία στην **ίδια** συλλογή με διακλάδωση στον κανόνα. **Απορρίφθηκε πριν
 * εκτελεστεί**: οι κανόνες Firestore **δεν φιλτράρουν** — μια συνθήκη «μόνο εγγραφές με
 * `companyId`» για τον super admin θα απέρριπτε **ολόκληρο** το αφιλτράριστο ερώτημα του
 * «Ιστορικού όλων», γιατί το ερώτημα δεν μπορεί να αποδείξει ότι δεν θα συναντήσει προσωπική
 * εγγραφή. Με διαμέρισμα ανά βιβλίο ο εταιρικός κανόνας μένει **ανέγγιχτος** και ο προσωπικός
 * είναι **μία** συνθήκη: `userId == request.auth.uid`. Η υπηρεσία, το σχήμα, ο αναγνώστης και η
 * οθόνη μένουν **ένα**.
 *
 * 🔑 **Το `?: never` είναι ο φρουρός.** Εγγραφή **και** με τα δύο δεν μεταγλωττίζεται — και
 * οι ~88 υπάρχοντες καλούντες με `companyId` μένουν **ανέγγιχτοι**, γιατί είναι ήδη το μέλος
 * εταιρείας της ένωσης. Δύο άξονες απομόνωσης σε ένα έγγραφο θα ήταν δύο απαντήσεις στο
 * «ποιος το βλέπει;» (δόγμα `services/firestore/tenant-config.ts`).
 *
 * 🏆 **Πρότυπο**: GitHub — το *security log* λογαριασμού το βλέπει **μόνο** ο κάτοχος, το
 * *audit log* οργανισμού **μόνο** οι owners· Figma — ο admin οργανισμού **δεν** βλέπει τα
 * Drafts μέλους. Εδώ τα δύο βιβλία είναι **διαμερίσματα του ίδιου συστήματος** με **έναν**
 * αναγνώστη (`ActivityTab`), και η εμβέλεια **παράγεται** από τη θεματοφυλακή του εγγράφου — δεν τη
 * διαλέγει κανείς, άρα δεν μπορεί να «μπει σε λάθος φάκελο».
 *
 * **Layering**: leaf — κανένα `server-only`, καμία ανάγνωση. Το εισάγουν διακομιστής και πελάτης.
 *
 * @module lib/audit/audit-ledger
 */

import type { CollectionKey } from '@/config/firestore-collections';
import type { WorkspaceRef } from '@/types/workspace-membership';

/** Βιβλίο **εταιρείας** — η εγγραφή ανήκει στον μισθωτή. */
export interface CompanyAuditLedger {
  readonly companyId: string;
  readonly userId?: never;
}

/** **Προσωπικό** βιβλίο — η εγγραφή ανήκει σε άνθρωπο, και τη διαβάζει μόνο εκείνος. */
export interface PersonalAuditLedger {
  readonly userId: string;
  readonly companyId?: never;
}

/** Η εμβέλεια μιας εγγραφής ιστορικού — **ακριβώς μία** από τις δύο. */
export type AuditLedgerScope = CompanyAuditLedger | PersonalAuditLedger;

/**
 * **Η ΜΙΑ μετάφραση** χώρου → βιβλίου.
 *
 * ⚠️ Δύο λεξιλόγια για το ίδιο πράγμα (`kind` στο `WorkspaceRef`, κλειδί πεδίου εδώ), γιατί το
 * έγγραφο Firestore χρειάζεται **επίπεδο** πεδίο: οι κανόνες και τα ευρετήρια το ρωτούν
 * απευθείας (`resource.data.userId == request.auth.uid`).
 */
export function auditLedgerScopeOf(workspace: WorkspaceRef): AuditLedgerScope {
  return workspace.kind === 'org'
    ? { companyId: workspace.companyId }
    : { userId: workspace.userId };
}

// ============================================================================
// ΤΟ ΑΙΤΗΜΑ ΑΝΑΓΝΩΣΗΣ — «ποιο βιβλίο ζητάω;»
// ============================================================================

/**
 * **Ποιο βιβλίο ζητά ο αναγνώστης** — ως **είδος**, χωρίς ταυτότητα.
 *
 * 🔴 **Δεν ταξιδεύει ποτέ `userId` στο σύρμα** (ίδιο δόγμα με το `RequestedWorkspace` του
 * ADR-787 Ε-5): το προσωπικό βιβλίο που μπορεί να ζητηθεί είναι **πάντα** του συνδεδεμένου, και
 * ο διακομιστής φιλτράρει με το **δικό του** `uid`. Ένα `userId` στο αίτημα θα ήταν πεδίο με
 * το οποίο κάποιος θα ζητούσε **ξένο** βιβλίο.
 */
export type AuditLedgerKind = 'company' | 'personal';

/** Τα δύο βιβλία, με σταθερή σειρά (το incremental backup τα σαρώνει **και τα δύο**). */
export const AUDIT_LEDGER_KINDS = ['company', 'personal'] as const satisfies readonly AuditLedgerKind[];

/**
 * **Πού ζει κάθε βιβλίο** — η **μία** δήλωση διαμερίσματος. Γραφέας, διαδρομή ανάγνωσης, πελάτης
 * και backup ρωτούν **εδώ**· κανείς δεν γράφει όνομα συλλογής ιστορικού με το χέρι.
 */
export const AUDIT_LEDGER_COLLECTION = {
  company: 'ENTITY_AUDIT_TRAIL',
  personal: 'ENTITY_AUDIT_TRAIL_PERSONAL',
} as const satisfies Record<AuditLedgerKind, CollectionKey>;

/** Το βιβλίο μιας εμβέλειας εγγραφής. */
export function auditLedgerKindOfScope(scope: AuditLedgerScope): AuditLedgerKind {
  return scope.userId !== undefined ? 'personal' : 'company';
}

/** Το όνομα της παραμέτρου στο σύρμα — **ένα**, για πελάτη και διακομιστή. */
export const AUDIT_LEDGER_PARAM = 'ledger';

/** Το είδος βιβλίου ενός χώρου — ο πελάτης το παράγει από τη θεματοφυλακή της οντότητας. */
export function auditLedgerKindOf(workspace: WorkspaceRef): AuditLedgerKind {
  return workspace.kind === 'org' ? 'company' : 'personal';
}

/**
 * **Ερμηνεία της παραμέτρου** — απουσία ⇒ `company` (ό,τι ίσχυε πάντα, **μηδέν** αλλαγή για
 * τους υπάρχοντες αναγνώστες).
 *
 * ⚠️ **Άγνωστη τιμή ⇒ `null` (άρνηση), ΠΟΤΕ προεπιλογή** — OWASP multi-tenant: *«fail closed if
 * the tenant context is missing or invalid»*. Ένα `ledger=Personal` δεν επιτρέπεται να γίνει
 * σιωπηλά εταιρικό βιβλίο.
 */
export function auditLedgerKindFromParam(value: string | null): AuditLedgerKind | null {
  if (value === null) return 'company';
  return value === 'company' || value === 'personal' ? value : null;
}

/** Μη κενή συμβολοσειρά — κενό δεν είναι κάτοχος, είναι **απουσία** κατόχου. */
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * **Το σύνορο ανάγνωσης** της εμβέλειας — από ωμά δεδομένα εγγράφου.
 *
 * 🔴 **`null` όταν δεν υπάρχει ΑΚΡΙΒΩΣ ΜΙΑ.** Εγγραφή χωρίς εμβέλεια **ή** με δύο δεν
 * αποδίδεται ποτέ: δεν ξέρουμε σε ποιον ανήκει, άρα δεν ξέρουμε ποιος δικαιούται να τη δει.
 * Ο καλών την **παραλείπει** — δεν μαντεύει.
 */
export function auditLedgerScopeFromData(data: Readonly<Record<string, unknown>>): AuditLedgerScope | null {
  const companyId = nonEmpty(data.companyId) ? data.companyId : null;
  const userId = nonEmpty(data.userId) ? data.userId : null;
  if (companyId !== null && userId === null) return { companyId };
  if (userId !== null && companyId === null) return { userId };
  return null;
}

/**
 * **Έγκυρη εμβέλεια για γραφή;** — ο φρουρός του γραφέα, ίδιο κριτήριο με το σύνορο ανάγνωσης.
 *
 * ⚠️ Ο τύπος εγγυάται **σχήμα**, όχι **τιμή**: ένα `{ userId: '' }` μεταγλωττίζεται και θα
 * γινόταν εγγραφή που **κανείς** δεν μπορεί να διαβάσει. Γι' αυτό ο γραφέας ρωτά **εδώ**.
 */
export function isWritableAuditLedgerScope(scope: AuditLedgerScope): boolean {
  return auditLedgerScopeFromData({ companyId: scope.companyId, userId: scope.userId }) !== null;
}
