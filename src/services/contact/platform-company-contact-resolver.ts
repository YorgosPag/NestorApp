import 'server-only';

/**
 * @fileoverview **ΧΩΡΟΣ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ → ΕΠΑΦΗ ΤΟΥ ΑΓΟΡΑΣΤΗ** — ο προμηθευτής της βιτρίνας ως εταιρική καρτέλα στις
 * επαφές του αγοραστή· **μία** ανά ζεύγος, ποτέ δεύτερη.
 * @related ADR-923 §5.13 Ε6γ (αίτημα προσφοράς από τη βιτρίνα) · αδελφός του `account-contact-resolver.ts`
 * @module services/contact/platform-company-contact-resolver
 *
 * 🔑 **Ταυτότητα, όχι αναζήτηση**: το id είναι ντετερμινιστικό από (αγοραστής, προμηθευτής), άρα το «υπάρχει ήδη;»
 * είναι **ένα `tx.get`** — χωρίς ερώτημα, χωρίς δείκτη, και δύο ταυτόχρονα αιτήματα συγκλίνουν στο ίδιο έγγραφο
 * (η δεύτερη συναλλαγή ξαναδιαβάζει και βρίσκει την επαφή). ⛔ **Ποτέ** ταύτιση ονόματος ή ΑΦΜ με χειρόγραφη
 * καρτέλα: η χειρόγραφη ανήκει στον άνθρωπο, και μια «συγχώνευση» θα έγραφε σε ξένα δεδομένα.
 *
 * 🔴 **Το πεδίο μόνο του δεν αποδεικνύει τίποτα**: `platformCompanyId` σε καρτέλα με **άλλο** id (π.χ. γραμμένο από
 * πελάτη) δεν είναι επαφή πλατφόρμας. Η μία κρίση είναι το {@link platformCompanyOfContact}: πεδίο **και** id **και**
 * χώρος. Την ίδια ρωτά και η παράδοση (Τ5), πριν λύσει διεύθυνση από τη ρύθμιση του προμηθευτή.
 *
 * ⛔ **Δεν γράφει**: επιστρέφει το έγγραφο, και ο καλών το γράφει **στη δική του** συναλλαγή (RFQ, γραμμές και επαφή,
 * ή τίποτα). Το ίχνος ADR-195 μετά το commit, με το κοινό `recordAccountContactBirth`.
 */

import type { DocumentData, Firestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { performerFromActorId } from '@/lib/audit/audit-performer';
import type { ResolvedPerformer } from '@/server/lib/performer-stamp';
import { buildContactDocument } from '@/services/ai-pipeline/shared/contact-document-builder';
import { generateDeterministicPlatformCompanyContactId } from '@/services/enterprise-id-convenience-catalog';
import { createDefaultPersonaData } from '@/types/contacts/personas';

export interface PlatformCompanyContactInput {
  readonly buyerCompanyId: string;
  readonly supplierCompanyId: string;
  /** Η επωνυμία από τη **βιτρίνα** του προμηθευτή — ποτέ από τον πελάτη. */
  readonly legalName: string;
  /** Λυμένος **πριν** από τη συναλλαγή (`resolvePerformer`), ώστε η επανάληψή της να μη ξαναδιαβάζει. */
  readonly performer: ResolvedPerformer;
}

/**
 * - `existing` ⇒ τίποτα να γραφτεί · `new` ⇒ ο καλών γράφει το `doc` στο `contactId`.
 * - `refused`: `self` (ο χώρος ζητά από τον εαυτό του) · `nameless` (βιτρίνα χωρίς επωνυμία) · `inactive` (ο άνθρωπος
 *   αρχειοθέτησε ή διέγραψε την καρτέλα — δεν την ξυπνά σιωπηλά η μηχανή) · `foreign` (το id είναι πιασμένο από
 *   έγγραφο που **δεν** είναι αυτή η επαφή — ποτέ αντικατάσταση).
 */
export type PlatformCompanyContactResolution =
  | { readonly kind: 'existing'; readonly contactId: string; readonly displayName: string }
  | { readonly kind: 'new'; readonly contactId: string; readonly displayName: string; readonly doc: Record<string, unknown> }
  | { readonly kind: 'refused'; readonly reason: 'self' | 'nameless' | 'inactive' | 'foreign' };

const INACTIVE_STATUSES: ReadonlySet<unknown> = new Set(['archived', 'deleted']);

/**
 * Ο άνθρωπος αρχειοθέτησε ή διέγραψε την καρτέλα. **Μία** κρίση για τη γέννηση (`judgeExisting`) **και** για την παράδοση
 * (ADR-923 §5.13 Τ5 Λ1β Χ1): σε ανενεργή επαφή πλατφόρμας δεν ξαναφεύγει αίτημα.
 */
export function isInactiveContact(data: DocumentData | undefined): boolean {
  return INACTIVE_STATUSES.has(data?.status);
}

/**
 * **Η μία κρίση «είναι επαφή πλατφόρμας;»** ⇒ ο χώρος του προμηθευτή, αλλιώς `null`. Ισχύει μόνο αν το id της
 * καρτέλας είναι το ντετερμινιστικό του ζεύγους (αγοραστής, `platformCompanyId`) και η καρτέλα ανήκει στον αγοραστή.
 */
export function platformCompanyOfContact(contactId: string, buyerCompanyId: string, data: DocumentData | undefined): string | null {
  const supplier = data?.platformCompanyId;
  if (typeof supplier !== 'string' || supplier === '' || data?.companyId !== buyerCompanyId) return null;
  if (data?.type !== 'company') return null;
  return contactId === generateDeterministicPlatformCompanyContactId(buyerCompanyId, supplier) ? supplier : null;
}

/** **Υπάρχουσα επαφή πλατφόρμας, ή καινούρια** — διαβάζει μέσα στη συναλλαγή του καλούντα, **πριν** από κάθε εγγραφή του. */
export async function resolvePlatformCompanyContact(
  tx: Transaction,
  db: Firestore,
  input: PlatformCompanyContactInput,
): Promise<PlatformCompanyContactResolution> {
  const { buyerCompanyId, supplierCompanyId } = input;
  if (buyerCompanyId === supplierCompanyId) return { kind: 'refused', reason: 'self' };
  const legalName = input.legalName.trim();
  if (legalName === '') return { kind: 'refused', reason: 'nameless' };

  const contactId = generateDeterministicPlatformCompanyContactId(buyerCompanyId, supplierCompanyId);
  const snap = await tx.get(db.collection(COLLECTIONS.CONTACTS).doc(contactId));
  if (snap.exists) return judgeExisting(contactId, buyerCompanyId, snap.data());

  const built = buildContactDocument({
    firstName: '',
    lastName: '',
    email: null,
    phone: null,
    type: 'company',
    companyId: buyerCompanyId,
    companyName: legalName,
    performer: performerFromActorId(input.performer.id, input.performer.name),
    // Η ταυτότητα του ζεύγους ΕΙΝΑΙ ο έλεγχος διπλοτύπου — καμία ασαφής ταύτιση.
    skipDuplicateCheck: true,
    platformCompanyId: supplierCompanyId,
    personas: [createDefaultPersonaData('supplier')],
  }, input.performer);
  return { kind: 'new', contactId, displayName: built.displayName, doc: built.doc };
}

function judgeExisting(contactId: string, buyerCompanyId: string, data: DocumentData | undefined): PlatformCompanyContactResolution {
  if (platformCompanyOfContact(contactId, buyerCompanyId, data) === null) return { kind: 'refused', reason: 'foreign' };
  if (isInactiveContact(data)) return { kind: 'refused', reason: 'inactive' };
  const displayName = typeof data?.displayName === 'string' ? data.displayName : '';
  return { kind: 'existing', contactId, displayName };
}
