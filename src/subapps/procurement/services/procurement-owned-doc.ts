/**
 * «ΑΥΤΟ το έγγραφο — αν είναι δικό μου»: φόρτωσε · διάβασε · σβήσε
 *
 * Η **μία** επιφάνεια με την οποία μιλά κάθε υπηρεσία προμηθειών όταν πιάνει
 * έγγραφο με id. Τρεις πράξεις, ένα συμβόλαιο ιδιοκτησίας.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (N.0.2 · CHECK 3.28 · ADR-742 Ομάδα 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι επτά υπηρεσίες προμηθειών έγραφαν **την ίδια τετράδα βημάτων** πριν από
 * κάθε μεταβολή:
 *
 * ```ts
 * const snap = await ref.get();
 * if (!snap.exists) throw …;              // υπάρχει;
 * const current = { id: snap.id, ...snap.data() } as XDoc;
 * if (current.companyId !== ctx.companyId) throw …;   // δικό μου;
 * ```
 *
 * Το `framework-agreement-service` το είχε ήδη αναγνωρίσει και είχε φτιάξει
 * τοπικό `loadOwnedAgreement` — με το σχόλιο *«ένας έλεγχος `companyId` που
 * υπάρχει σε δύο αντιγραμμένα σημεία είναι μία επεξεργασία μακριά από το να
 * υπάρχει μόνο στο ένα»*. Το ίδιο σκεπτικό ισχύει **ανάμεσα** στις υπηρεσίες,
 * όχι μόνο μέσα σε καθεμία: το `jscpd` μετρούσε ήδη τη διπλή γραφή ως κλώνο
 * **στο HEAD**.
 *
 * 🔴 **Ο λόγος δεν είναι το μήκος — είναι ότι η σειρά των βημάτων είναι
 * συμβόλαιο ασφαλείας.** Αν ένα αντίγραφο ρωτήσει «δικό μου;» **μετά** από μια
 * ενέργεια, ή παραλείψει τον έλεγχο ύπαρξης, η διαφορά **δεν φαίνεται
 * πουθενά**: η υπηρεσία απαντά κανονικά, απλώς είναι λιγότερο προστατευμένη
 * από τις αδελφές της (ίδιο επιχείρημα με το `_domain-route.ts`, ADR-742 §7.8).
 *
 * ⚠️ Ο φύλακας δέχεται το **ωμό** `snap.data()`, όχι το `as XDoc` αντικείμενο:
 * ο τύπος υπόσχεται `companyId: string`, η βάση δεν το εγγυάται (§7.5). Το
 * `as` επιβιώνει **μόνο** για την τιμή που επιστρέφεται στον καλούντα, αφού ο
 * φύλακας έχει ήδη αποφανθεί.
 *
 * @module subapps/procurement/services/procurement-owned-doc
 * @see ./procurement-ownership (η ερώτηση + οι δύο πολιτικές)
 * @see ADR-742 §3.3, §7.5, §7.8 · ADR-195 (ίχνος ελέγχου)
 */

import 'server-only';

import admin from 'firebase-admin';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { EntityAuditService } from '@/services/entity-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { ownedOrNull, type MaybeTenantOwned } from '@/lib/auth/tenant-ownership';
import type { AuditEntityType } from '@/types/audit-trail';
import {
  assertOwnedProcurementDoc,
  procurementNotFound,
  type ProcurementSubject,
} from './procurement-ownership';

/**
 * **Μία επιφάνεια εισαγωγής για τις υπηρεσίες.**
 *
 * Το `procurement-ownership` είναι **καθαρό** επίτηδες, γιατί το μοιράζεται το
 * σύνορο HTTP· οι υπηρεσίες όμως χρειάζονται πάντα **και** τα ονόματα πόρων
 * **και** τον φορτωτή, μαζί. Δύο εισαγωγές που εμφανίζονται πάντα ζευγαρωτά σε
 * επτά αρχεία είναι απλώς μια επανάληψη που ο άνθρωπος πρέπει να θυμάται —
 * και το CHECK 3.28 τη μετρούσε ως κλώνο (ολόκληρο το μπλοκ import έγινε
 * πανομοιότυπο μόλις οι υπηρεσίες άρχισαν να δείχνουν στα ίδια modules).
 *
 * ⚠️ **Δεν** επανεξάγεται το `assertOwnedProcurementDoc` / `procurementNotFound`:
 * μια υπηρεσία που τα καλεί απευθείας παρακάμπτει τον φορτωτή — δηλαδή ξαναχτίζει
 * την αλυσίδα με το χέρι. Ο περιορισμός είναι το ζητούμενο, όχι παράλειψη.
 */
export { PROCUREMENT_RESOURCE, type ProcurementResource } from './procurement-ownership';

/** Ό,τι φορτώνεται για μεταβολή: το έγγραφο **και** η αναφορά που θα γραφτεί. */
export interface OwnedProcurementDoc<T> {
  readonly ref: FirebaseFirestore.DocumentReference;
  readonly current: T;
}

/**
 * **Γ — ρητή άρνηση.** Για κάθε μεταβολή: φόρτωσε, βεβαιώσου ότι υπάρχει,
 * βεβαιώσου ότι ανήκει στον καλούντα, δώσε πίσω έγγραφο **και** αναφορά.
 *
 * Ρίχνει `ProcurementNotFoundError` (δεν υπάρχει) ή
 * `ProcurementCrossTenantError` (ανήκει αλλού) — τυποποιημένα, ώστε το σύνορο
 * HTTP να αποφασίσει τι φεύγει στο σύρμα χωρίς ποτέ να διαβάσει κείμενο.
 */
export async function loadOwnedProcurementDoc<T>(
  ref: FirebaseFirestore.DocumentReference,
  companyId: string,
  subject: ProcurementSubject,
): Promise<OwnedProcurementDoc<T>> {
  return { ref, current: requireOwnedSnapshot<T>(await ref.get(), companyId, subject) };
}

/**
 * Το ελάχιστο σχήμα στιγμιότυπου που χρειάζεται η ερώτηση.
 *
 * Δηλώνεται δομικά αντί να εισαχθεί ο τύπος του `firebase-admin` για **δύο**
 * λόγους: το `tx.get(ref)` μέσα σε συναλλαγή δίνει το ίδιο σχήμα, και ο
 * φύλακας γίνεται δοκιμάσιμος με σκέτα αντικείμενα.
 */
export interface OwnedSnapshot {
  readonly exists: boolean;
  readonly id: string;
  data(): FirebaseFirestore.DocumentData | undefined;
}

/**
 * **Ο ίδιος φύλακας, σε επίπεδο στιγμιότυπου** — για τα μονοπάτια που έχουν
 * ήδη διαβάσει μέσα σε **συναλλαγή** (`tx.get(ref)`).
 *
 * 🔴 Υπάρχει ώστε οι συναλλαγές να **μη χρειαστεί** να ξαναγράψουν τον έλεγχο.
 * Οι τρεις συναλλαγές του `sourcing-event-service` (σύνδεση/αποσύνδεση RFQ,
 * επαναϋπολογισμός κατάστασης) δεν μπορούν να καλέσουν `ref.get()` — θα
 * έσπαγε η ατομικότητα. Χωρίς αυτή τη μορφή, η μόνη επιλογή τους θα ήταν
 * **χειρόγραφος** έλεγχος: ακριβώς η διασπορά που κλείνει η Ομάδα 2.
 */
export function requireOwnedSnapshot<T>(
  snap: OwnedSnapshot,
  companyId: string,
  subject: ProcurementSubject,
): T {
  if (!snap.exists) throw procurementNotFound(subject);
  assertOwnedProcurementDoc(snap.data() ?? {}, companyId, subject);
  return { id: snap.id, ...snap.data() } as T;
}

/**
 * **Δ — σιωπηλή πολιτική.** Για κάθε ανάγνωση με id: ξένο ≡ ανύπαρκτο.
 *
 * Επιστρέφει `null` και για τους **δύο** λόγους, ώστε ο καλών να μη μπορεί να
 * τους ξεχωρίσει — άρα ούτε να χαρτογραφήσει ξένα id (ADR-742 §3.3, ADR-734 §7).
 */
export async function readOwnedProcurementDoc<T extends MaybeTenantOwned>(
  ref: FirebaseFirestore.DocumentReference,
  companyId: string,
  subject: ProcurementSubject,
): Promise<T | null> {
  const snap = await ref.get();
  if (!snap.exists) return null;
  return ownedOrNull({ id: snap.id, ...snap.data() } as T, companyId, subject);
}

// ============================================================================
// SOFT DELETE
// ============================================================================

/** Το ελάχιστο που πρέπει να ξέρει η διαγραφή για το έγγραφο. */
interface SoftDeletable {
  readonly isDeleted?: boolean;
}

/** Τι γράφεται στο ίχνος ελέγχου — το μόνο που διαφέρει ανά πόρο. */
export interface SoftDeleteAudit {
  /** Τιμή από το `ENTITY_TYPES` (ADR-195) — ο **στενός** τύπος του ίχνους. */
  readonly entityType: AuditEntityType;
  /** Ανθρώπινο όνομα, π.χ. `«ΥΛ-001 — Τσιμέντο»`. */
  readonly entityName: string | null;
}

export interface SoftDeleteSpec<T extends SoftDeletable> {
  readonly ref: FirebaseFirestore.DocumentReference;
  readonly companyId: string;
  readonly performedBy: string;
  readonly subject: ProcurementSubject;
  /** Υπολογίζεται **μετά** τη φόρτωση: το όνομα βγαίνει από το ίδιο το έγγραφο. */
  readonly audit: (current: T) => SoftDeleteAudit;
  /** Ετικέτα για το `safeFireAndForget`, π.χ. `'material-service.softDelete'`. */
  readonly logTag: string;
}

/**
 * **Ιδεμποτεντική λογική διαγραφή** εγγράφου που ανήκει στον καλούντα.
 *
 * Το `material-service` και το `framework-agreement-service` έγραφαν **την ίδια
 * πεντάδα βημάτων**, με μόνη διαφορά τα ονόματα του πόρου:
 *
 * 1. φόρτωσε και βεβαιώσου ότι ανήκει στον καλούντα
 * 2. **αν είναι ήδη σβησμένο, γύρνα σιωπηλά**
 * 3. σήμανε `isDeleted: true` **και** `updatedAt`
 * 4. κατάγραψε `soft_deleted` στο ίχνος ελέγχου
 * 5. κατάγραψε στο log
 *
 * 🔴 **Τα βήματα 2 και 3 είναι συμβόλαιο, όχι στιλ.** Αντίγραφο που ξεχνά το
 * βήμα 2 βγάζει **δεύτερη** εγγραφή ελέγχου σε επανάληψη· που ξεχνά το
 * `updatedAt` αφήνει σβησμένο έγγραφο με ημερομηνία της τελευταίας
 * *επεξεργασίας*. Καμία απόκλιση δεν φαίνεται πουθενά — η υπηρεσία απαντά
 * κανονικά (ίδιο επιχείρημα με το `_domain-route.ts`, ADR-742 §7.8).
 *
 * @returns `true` αν έγινε διαγραφή τώρα, `false` αν ήταν ήδη σβησμένο
 */
export async function softDeleteOwnedProcurementDoc<T extends SoftDeletable>(
  spec: SoftDeleteSpec<T>,
): Promise<boolean> {
  const { ref, current } = await loadOwnedProcurementDoc<T>(
    spec.ref,
    spec.companyId,
    spec.subject,
  );
  if (current.isDeleted) return false;

  await ref.update(
    sanitizeForFirestore({
      isDeleted: true,
      updatedAt: admin.firestore.Timestamp.now(),
    }),
  );

  const { entityType, entityName } = spec.audit(current);
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType,
      entityId: spec.subject.resourceId,
      entityName,
      action: 'soft_deleted',
      changes: [],
      performedBy: spec.performedBy,
      performedByName: null,
      companyId: spec.companyId,
    }),
    spec.logTag,
  );
  return true;
}
