/**
 * Φύλακας εμβέλειας Σύμβασης-Πλαίσιο πριν από κάθε εγγραφή — ADR-923 §5.11 «3γ» (Βήμα 2)
 *
 * Η φόρμα δείχνει τα ίδια προβλήματα ζωντανά· εδώ είναι το **δίχτυ ασφαλείας** του server, ώστε καμία
 * διαδρομή (API, πράκτορας, δεύτερη καρτέλα) να μη γράψει σύμβαση που:
 *   1. έχει «Επιλεγμένα» με **κενή** λίστα (`[]` = «σε τίποτα» — σύμβαση χωρίς αντικείμενο)·
 *   2. αναφέρει κατηγορία ΑΤΟΕ εκτός καταλόγου ή υλικό/έργο που **δεν** ανήκει στην εταιρεία
 *      (ξένο ≡ ανύπαρκτο: ίδια απάντηση, κανένα μαντείο ύπαρξης — ADR-742)·
 *   3. ως **ενεργή** θα ισοβαθμούσε με άλλη ενεργή σύμβαση του προμηθευτή (SAP: επικαλυπτόμενες εγγραφές
 *      συνθήκης με το ίδιο κλειδί απορρίπτονται· ο κατάλογος αρνείται ήδη `discountConditionAmbiguous`).
 *      Η ισοπαλία κρίνεται από τον **ίδιο** επιλογέα με την τιμολόγηση (`findAgreementTies`).
 *
 * Οι συμβάσεις του προμηθευτή τις δίνει ο καλών (ο service), ώστε να μην υπάρχει κυκλική εξάρτηση.
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { findATOECategory } from '@/config/boq-categories';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { FrameworkAgreementValidationError, type FrameworkAgreementLike } from '../types/framework-agreement';
import { findAgreementTies } from '../utils/framework-agreement-ambiguity';

export type VendorAgreementsLoader = () => Promise<readonly FrameworkAgreementLike[]>;

type ScopeField ='applicableMaterialIds' | 'applicableProjectIds' | 'applicableAtoeCategoryCodes';

const SCOPE_FIELDS: readonly ScopeField[] = ['applicableMaterialIds', 'applicableProjectIds', 'applicableAtoeCategoryCodes'];

function assertNoEmptySelection(agreement: FrameworkAgreementLike): void {
  for (const field of SCOPE_FIELDS) {
    if (agreement[field]?.length === 0) {
      throw new FrameworkAgreementValidationError(field, `${field}: an explicit selection must contain at least one entry`);
    }
  }
}

function assertKnownCategories(codes: readonly string[] | null): void {
  const unknown = (codes ?? []).filter((code) => findATOECategory(code) === undefined);
  if (unknown.length > 0) {
    throw new FrameworkAgreementValidationError('applicableAtoeCategoryCodes', `Unknown ATOE categories: ${unknown.join(', ')}`);
  }
}

/** Κάθε ταυτότητα υπάρχει **και** ανήκει στην εταιρεία· αλλιώς «άγνωστη» (χωρίς διάκριση ξένου/ανύπαρκτου). */
async function assertOwnedReferences(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  collection: string,
  ids: readonly string[] | null,
  field: ScopeField,
): Promise<void> {
  const unique = [...new Set(ids ?? [])];
  if (unique.length === 0) return;
  const snaps = await db.getAll(...unique.map((id) => db.collection(collection).doc(id)));
  const unknown = snaps.filter((snap) => !snap.exists || !isPayloadOwnedByCompany(snap.data(), companyId)).map((snap) => snap.id);
  if (unknown.length > 0) {
    throw new FrameworkAgreementValidationError(field, `${field}: unknown references ${unknown.join(', ')}`);
  }
}

/** Ο ΜΟΝΟΣ που αποφασίζει «μπλοκάρει μόνο η ενεργή»· φορτώνει τις συμβάσεις μόνο τότε. */
async function assertNoTies(agreement: FrameworkAgreementLike, loadVendorAgreements: VendorAgreementsLoader): Promise<void> {
  if (agreement.status !== 'active' || agreement.isDeleted) return;
  const ties = findAgreementTies(agreement, await loadVendorAgreements());
  if (ties.length > 0) {
    const numbers = ties.map((tie) => tie.agreementNumber).join(', ');
    throw new FrameworkAgreementValidationError('scope', `Ambiguous with active agreement(s) ${numbers}: equally specific scope and overlapping validity`);
  }
}

/**
 * Όλοι οι έλεγχοι εμβέλειας πάνω στην **τελική** μορφή της σύμβασης (create: το νέο έγγραφο ·
 * update: αποθηκευμένο + αλλαγές). `loadVendorAgreements`: οι συμβάσεις του ίδιου προμηθευτή — καλείται
 * μόνο όταν χρειάζεται (ενεργή σύμβαση) και **ρίχνει** σε αποτυχία (ποτέ «κενό ⇒ καμία ισοπαλία»).
 */
export async function assertAgreementScope(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  agreement: FrameworkAgreementLike,
  loadVendorAgreements: VendorAgreementsLoader,
): Promise<void> {
  assertNoEmptySelection(agreement);
  assertKnownCategories(agreement.applicableAtoeCategoryCodes);
  await assertOwnedReferences(db, companyId, COLLECTIONS.MATERIALS, agreement.applicableMaterialIds, 'applicableMaterialIds');
  await assertOwnedReferences(db, companyId, COLLECTIONS.PROJECTS, agreement.applicableProjectIds, 'applicableProjectIds');
  await assertNoTies(agreement, loadVendorAgreements);
}
