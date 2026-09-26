import 'server-only';

/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΓΙΝΕΤΑΙ ΕΠΑΦΗ** — με την έγκριση, ο αιτών μπαίνει στο CRM του γραφείου (ADR-884 Φ0.13β · Κ3β).
 * @related `services/contact/account-contact-resolver.ts` (ο ΕΝΑΣ κριτής «υπάρχει ήδη;», κοινός με ADR-827) ·
 *   `tour-access-decision.ts` (η συναλλαγή που γράφει)
 * @module server/spatial-tour/tour-access-contact
 *
 * 🏆 **Πέρα από το Google Drive**: ο μεσίτης δεν ξαναπληκτρολογεί τίποτα — όποιος εγκρίθηκε να δει το σπίτι
 * είναι **ήδη** επαφή του, δεμένη με το αίτημα (`contactId`).
 *
 * 🔑 **Γιατί με την ΕΓΚΡΙΣΗ και όχι με το αίτημα**: το αίτημα το κάνει οποιοσδήποτε με λογαριασμό· η έγκριση
 * είναι **κρίση ανθρώπου** («αυτός είναι πελάτης μου»). Ίδιο δόγμα με την αποδοχή εντολής (ADR-827 Σ3) — η
 * απορριφθείσα αίτηση δεν γεμίζει το CRM με θόρυβο.
 *
 * 🔑 **Μόνο εταιρικός κάτοχος**: ο ιδιώτης ιδιοκτήτης δεν έχει CRM — βλέπει τον αιτούντα στη λίστα του.
 *
 * ⚠️ **Η επαφή είναι παρενέργεια, όχι όρος**: αποτυχία ανάγνωσης CRM (`unavailable`) **δεν** μπλοκάρει την έγκριση —
 * ο υπεύθυνος αποφάσισε να δείξει το σπίτι· η οθόνη λέει «η επαφή δεν δημιουργήθηκε». Ποτέ όμως «γράψε καινούρια»
 * πάνω σε άγνωστο (δεύτερη καρτέλα για τον ίδιο άνθρωπο).
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { tourAccessRequestFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { readAccountIdentities, type AccountIdentity } from '@/server/auth/account-identities';
import {
  resolveAccountContact,
  type AccountContactIdentity,
  type ResolvedAccountContact,
} from '@/services/contact/account-contact-resolver';

import { tourAccessRequestRef } from './tour-access-shared';

/** Τι απέγινε η επαφή ενός εγκεκριμένου — ταξιδεύει στην οθόνη του υπευθύνου. */
export type TourAccessContactOutcome = 'linked' | 'created' | 'unavailable' | 'none';

/** Η επαφή **έτοιμη** για τη συναλλαγή — ή ο λόγος που δεν υπάρχει. */
export type PreparedTourContact =
  | { readonly kind: 'resolved'; readonly contact: ResolvedAccountContact }
  | { readonly kind: 'already-linked' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'none' };

/** Λογαριασμός → ό,τι ζητά η καρτέλα. Χωρίς email **δεν** γίνεται επαφή (δεν θα τη βρίσκαμε ποτέ ξανά). */
function contactIdentityOf(account: AccountIdentity | undefined): AccountContactIdentity | null {
  if (account === undefined || account.email === null) return null;
  const givenName = account.givenName ?? account.displayName ?? account.email;
  return { givenName, familyName: account.familyName ?? '', email: account.email, vatNumber: null };
}

async function alreadyLinked(tourRef: DocumentReference, uid: string): Promise<boolean> {
  const snap = await tourAccessRequestRef(tourRef, uid).get();
  const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), snap.id) : null;
  return stored?.contactId !== null && stored?.contactId !== undefined;
}

/**
 * **Προετοιμασία** — μόνο αναγνώσεις, όλα ακυρώσιμα (πρότυπο ADR-827: «η ετοιμασία δεν δεσμεύει τη συναλλαγή»).
 * Επιστρέφει ανά αιτούντα την επαφή που θα γραφτεί **μέσα** στη συναλλαγή της έγκρισης.
 */
export async function prepareTourAccessContacts(
  db: Firestore,
  input: { readonly tourRef: DocumentReference; readonly uids: readonly string[]; readonly companyId: string; readonly deciderUid: string },
): Promise<ReadonlyMap<string, PreparedTourContact>> {
  const identities = await readAccountIdentities(db, input.uids);
  const entries = await Promise.all(input.uids.map(async (uid): Promise<[string, PreparedTourContact]> => {
    if (await alreadyLinked(input.tourRef, uid)) return [uid, { kind: 'already-linked' }];
    const identity = contactIdentityOf(identities.get(uid));
    if (identity === null) return [uid, { kind: 'none' }];
    const resolved = await resolveAccountContact({ identity, companyId: input.companyId, createdBy: input.deciderUid });
    return [uid, 'kind' in resolved ? { kind: 'unavailable' } : { kind: 'resolved', contact: resolved }];
  }));
  return new Map(entries);
}

/** Η προετοιμασία → τι λέμε στην οθόνη **αφού** γράφτηκε η έγκριση. */
export function contactOutcomeOf(prepared: PreparedTourContact | undefined): TourAccessContactOutcome {
  if (prepared === undefined || prepared.kind === 'none') return 'none';
  if (prepared.kind === 'already-linked') return 'linked';
  if (prepared.kind === 'unavailable') return 'unavailable';
  return prepared.contact.doc === null ? 'linked' : 'created';
}
