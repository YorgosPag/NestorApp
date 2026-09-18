import 'server-only';

/**
 * @fileoverview **Η ΠΥΛΗ ΓΡΑΦΗΣ ΤΟΥ ΦΑΚΕΛΟΥ** — η μόνη διαδρομή προς το `property_dossiers`.
 * @related ADR-866 Φ1.1 · §2.8 (Γ1 · Γ2 · Δ4) · Ε-Φ1-1 · lib/workspace/grant-membership.ts (πρότυπο δέσμης)
 * @module services/property-dossier/property-dossier-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΜΟΡΦΕΣ, ΕΝΑΣ ΓΡΑΦΕΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · {@link stagePropertyDossierBirth} — η γέννηση **μέσα σε δέσμη ή συναλλαγή του καλούντος**. Υπάρχει
 *   για την Ε-Φ1-1: ο φάκελος γεννιέται **στην ίδια δέσμη** με κάθε αγγελία ιδιώτη (Φ1.3), ώστε να μην
 *   υπάρξει ποτέ αγγελία που δείχνει σε φάκελο που δεν υπάρχει. **Όχι** δεύτερος γραφέας τότε.
 * · {@link createPropertyDossier} — η γέννηση **αυτοτελώς** («Νέος φάκελος», χωρίς αγγελία).
 * · {@link updatePropertyDossier} — κάθε **μεταβολή** μετά τη γέννηση (Φ1.2): μετονομασία/είδος · αρχειοθέτηση/επαναφορά.
 *   **Ίδιος** γραφέας, ίδιο ίχνος — όχι δεύτερη διαδρομή προς τη συλλογή.
 *
 * ⛔ **Η ΣΤΑΔΙΟΠΟΙΗΣΗ ΜΕΝΕΙ ΚΑΘΑΡΗ** (δόγμα του `grantWorkspaceMembershipInTx`): **καμία ανάγνωση**
 * (το Firestore θέλει όλες τις αναγνώσεις μιας συναλλαγής **πριν** από κάθε γραφή — μια κρυμμένη `get()`
 * θα έσπαγε τον καλούντα) και **καμία παρενέργεια** (το σώμα συναλλαγής **ξανατρέχει** σε σύγκρουση —
 * ένα ίχνος εδώ θα έφευγε μία φορά ανά προσπάθεια). Το ίχνος το γράφει ο καλών **μετά** το `commit()`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΚΑΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **`addDoc` / αυτόματη ταυτότητα — ΠΟΤΕ** (N.6). Την ταυτότητα `pdos_*` την προ-γεννά ο πελάτης
 *    και την επικυρώνει το μητρώο (§2.8.7 Δ4).
 * 2. **`set()` στη γέννηση — ΠΟΤΕ.** Με ταυτότητα από τον πελάτη, ένα `set()` θα άφηνε οποιονδήποτε να
 *    **γράψει πάνω σε ξένο φάκελο** στέλνοντας την ταυτότητά του. Το `create()` **πετά** αν υπάρχει — η
 *    άρνηση είναι του Firestore, όχι ελέγχου που κάποιος πρέπει να θυμηθεί.
 * 3. **Κάτοχος από το σώμα του αιτήματος — ΠΟΤΕ.** Το `PropertyDossierDraft` δεν τον περιέχει· έρχεται
 *    **μόνο** ως `PropertyDossierBirth` από τον διακομιστή.
 */

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { isAlreadyExistsError } from '@/lib/firestore/firestore-already-exists';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import { recordPropertyDossierWrite } from '@/services/property-dossier/property-dossier-audit';
import {
  applyPropertyDossierChange,
  newPropertyDossier,
  propertyDossierInvariantViolations,
  type PropertyDossier,
  type PropertyDossierBirth,
  type PropertyDossierChange,
  type PropertyDossierDraft,
  type PropertyDossierInvariant,
} from '@/types/property-dossier';

const logger = createModuleLogger('property-dossier-write.service');

/**
 * Ό,τι μπορεί να δεχτεί τη γέννηση: `WriteBatch` **ή** `Transaction` του Admin SDK — και τα δύο έχουν
 * `create(ref, data)`. Δομικός τύπος, ώστε ο καλών να διαλέγει ατομικότητα **χωρίς** δεύτερη υπογραφή.
 */
export interface PropertyDossierBirthWriter {
  create(ref: DocumentReference, data: PropertyDossier): unknown;
}

/** Η έκβαση μιας γραφής — **κλειστό** σύνολο· η πόρτα απαντά κάθε μέλος ρητά. */
export type PropertyDossierWriteResult =
  /**
   * `replayed`: το αποτέλεσμα **υπήρχε ήδη** και **δεν** γράφτηκε τίποτα — ιδεμπότητο, όχι σφάλμα. Γέννηση: η **ίδια**
   * ξαναστάλθηκε από τον **ίδιο** κάτοχο. Μεταβολή (Φ1.2): ο φάκελος ήταν **ήδη** σε αυτή την κατάσταση (διπλό κλικ ·
   * δύο καρτέλες · «Αναίρεση» που πρόλαβε άλλη καρτέλα) ⇒ καμία εγγραφή, **κανένα** ίχνος.
   */
  | { readonly kind: 'saved'; readonly dossier: PropertyDossier; readonly replayed: boolean }
  | { readonly kind: 'invalid'; readonly violations: readonly PropertyDossierInvariant[] }
  /** «Δεν υπάρχει **για σένα**» — και για ξένη ταυτότητα: ποτέ επιβεβαίωση ύπαρξης ξένου φακέλου. */
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed'; readonly message: string };

/** Το έγγραφο ενός φακέλου — **ένα** σημείο που ονομάζει τη συλλογή. */
function dossierRef(adminDb: AdminFirestore, dossierId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(dossierId);
}

/**
 * **Βάλε τη γέννηση σε δέσμη/συναλλαγή του καλούντος.** Καθαρό: μόνο `create`.
 *
 * ⚠️ Ο καλών κρίνει πρώτα τα invariants ({@link propertyDossierInvariantViolations}) και, **μετά** το
 * `commit()`, καλεί το `recordPropertyDossierWrite(dossier, { performedBy, before: null })`.
 */
export function stagePropertyDossierBirth(
  writer: PropertyDossierBirthWriter,
  adminDb: AdminFirestore,
  dossier: PropertyDossier,
): void {
  writer.create(dossierRef(adminDb, dossier.id), dossier);
}

/**
 * **Η επανάληψη μιας γέννησης** — η ταυτότητα υπάρχει ήδη.
 *
 * 🔑 Η ταυτότητα **είναι** το κλειδί ιδεμποτίας (ADR-866 §2.8.7 Δ4): αν ο φάκελος ανήκει στον **ίδιο**
 * κάτοχο, πρόκειται για διπλό κλικ ή επανάληψη δικτύου ⇒ απαντάμε με τον **υπάρχοντα** (όπως ένα
 * `Idempotency-Key` του Stripe, χωρίς πίνακα κλειδιών). Αλλιώς ⇒ `absent`: η ύπαρξη ξένου φακέλου
 * **δεν** επιβεβαιώνεται ποτέ.
 */
async function replayedBirth(
  adminDb: AdminFirestore,
  birth: PropertyDossierBirth,
): Promise<PropertyDossierWriteResult> {
  let data: Readonly<Record<string, unknown>> | undefined;
  try {
    data = (await dossierRef(adminDb, birth.id).get()).data();
  } catch (error) {
    return failure(birth.id, error);
  }
  if (!isOwnedByCustody(data, { userId: birth.userId })) return { kind: 'absent' };
  const dossier = propertyDossierFromDocument(data, birth.id);
  return dossier === null ? { kind: 'absent' } : { kind: 'saved', dossier, replayed: true };
}

/** Αστοχία βάσης — μία διατύπωση· ο άνθρωπος δεν έχει τι να διορθώσει (`500`). */
function failure(dossierId: string, error: unknown): PropertyDossierWriteResult {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Ο φάκελος δεν αποθηκεύτηκε', { data: { dossierId }, error: message });
  return { kind: 'failed', message };
}

/**
 * **Νέος φάκελος, αυτοτελώς.**
 *
 * Η σειρά είναι συμβόλαιο: **invariants** (καθαρή συνάρτηση, η ίδια με της φόρμας) → **γραφή** →
 * **ίχνος** μόνο μετά από επιτυχία (ποτέ για γραφή που απέτυχε).
 */
export async function createPropertyDossier(
  adminDb: AdminFirestore,
  birth: PropertyDossierBirth,
  draft: PropertyDossierDraft,
): Promise<PropertyDossierWriteResult> {
  const violations = propertyDossierInvariantViolations(draft);
  if (violations.length > 0) return { kind: 'invalid', violations };

  const dossier = newPropertyDossier(birth, draft, nowISO());
  try {
    const batch = adminDb.batch();
    stagePropertyDossierBirth(batch, adminDb, dossier);
    await batch.commit();
  } catch (error) {
    return isAlreadyExistsError(error) ? replayedBirth(adminDb, birth) : failure(dossier.id, error);
  }

  await recordPropertyDossierWrite(dossier, { performedBy: birth.userId, before: null });
  return { kind: 'saved', dossier, replayed: false };
}

/** Ποιος ζητά μεταβολή σε **ποιον** φάκελο — ο κάτοχος έρχεται **πάντα** από τον διακομιστή. */
export interface PropertyDossierTarget {
  readonly dossierId: string;
  readonly userId: string;
}

/** Η έκβαση **μέσα** στη συναλλαγή: είτε τελική απάντηση, είτε το ζεύγος πριν/μετά για το ίχνος. */
type ChangeOutcome =
  | { readonly kind: 'settled'; readonly result: PropertyDossierWriteResult }
  | { readonly kind: 'written'; readonly before: PropertyDossier; readonly after: PropertyDossier };

/** Τα invariants κρίνονται **μόνο** για ό,τι συντάσσει ο άνθρωπος — ποτέ για αρχειοθέτηση (βλ. `PropertyDossierChange`). */
function changeViolations(change: PropertyDossierChange): readonly PropertyDossierInvariant[] {
  return change.kind === 'details' ? propertyDossierInvariantViolations(change.draft) : [];
}

/**
 * **Το σώμα της συναλλαγής** — ανάγνωση, κρίση κατοχής, επόμενη κατάσταση, γραφή.
 *
 * ⚠️ **Καμία παρενέργεια εδώ**: το σώμα **ξανατρέχει** σε σύγκρουση· το ίχνος γράφεται από τον καλούντα **μετά**.
 */
async function stageChange(
  tx: Transaction,
  ref: DocumentReference,
  target: PropertyDossierTarget,
  change: PropertyDossierChange,
): Promise<ChangeOutcome> {
  const data = (await tx.get(ref)).data();
  // 🔴 «Δεν υπάρχει» και «δεν είναι δικός σου» ⇒ ΙΔΙΑ απάντηση: ποτέ επιβεβαίωση ύπαρξης ξένου φακέλου.
  const before = isOwnedByCustody(data, { userId: target.userId })
    ? propertyDossierFromDocument(data, target.dossierId)
    : null;
  if (before === null) return { kind: 'settled', result: { kind: 'absent' } };

  const after = applyPropertyDossierChange(before, change, nowISO());
  if (after === before) return { kind: 'settled', result: { kind: 'saved', dossier: before, replayed: true } };

  tx.update(ref, { label: after.label, type: after.type, lifecycle: after.lifecycle, updatedAt: after.updatedAt });
  return { kind: 'written', before, after };
}

/**
 * **Μεταβολή φακέλου** — μετονομασία/είδος ή αρχειοθέτηση/επαναφορά (ADR-866 Φ1.2 · §2.9.1 Α2).
 *
 * 🔑 **Συναλλαγή, όχι ανάγνωση-μετά-γραφή** (το σκαλί πάνω από το `setOwnerPropertyLifecycle`): δύο καρτέλες που
 * μετονομάζουν και αρχειοθετούν ταυτόχρονα **δεν** χάνουν η μία την αλλαγή της άλλης (N.7.2 #2) — η δεύτερη
 * ξαναδιαβάζει. Ίχνος **μόνο** για ό,τι γράφτηκε, **μετά** το commit — `status_changed` όταν άλλαξε μόνο ο κύκλος
 * ζωής, αλλιώς `updated` (`entity-audit-tracked-write.ts`).
 */
export async function updatePropertyDossier(
  adminDb: AdminFirestore,
  target: PropertyDossierTarget,
  change: PropertyDossierChange,
): Promise<PropertyDossierWriteResult> {
  const violations = changeViolations(change);
  if (violations.length > 0) return { kind: 'invalid', violations };

  let outcome: ChangeOutcome;
  try {
    const ref = dossierRef(adminDb, target.dossierId);
    outcome = await adminDb.runTransaction((tx) => stageChange(tx, ref, target, change));
  } catch (error) {
    return failure(target.dossierId, error);
  }
  if (outcome.kind === 'settled') return outcome.result;

  await recordPropertyDossierWrite(outcome.after, { performedBy: target.userId, before: outcome.before });
  return { kind: 'saved', dossier: outcome.after, replayed: false };
}
