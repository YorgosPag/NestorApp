import 'server-only';

/**
 * @fileoverview **Τι βλέπει η κάρτα «Η επαφή του χώρου»** — ο δεσμός, ή αλλιώς η πρόταση (ADR-951).
 * @module server/company/self-contact-read.server
 *
 * Η πρόταση υπολογίζεται **μόνο** όταν δεν υπάρχει δεσμός: ένας συνδεδεμένος χώρος δεν πληρώνει ερώτημα ΑΦΜ.
 * 🔑 Βλάβη ανάγνωσης του προφίλ ⇒ `unavailable`, **ποτέ** «δεν έχει ΑΦΜ»: μια πρόταση από δεδομένα που δεν διαβάστηκαν
 *    θα έλεγε στον άνθρωπο ψέμα για τα στοιχεία του.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { selfContactOf } from '@/lib/company/self-contact-ref';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readCompanyTaxDeclaration } from '@/services/company/company-legal-identity';
import type { SelfContactView } from '@/types/company-self-contact';
import { selfContactCandidateOf, suggestSelfContact } from './self-contact-suggestion.server';

export type SelfContactRead =
  | { readonly kind: 'present'; readonly view: SelfContactView }
  /** Το έγγραφο του χώρου δεν υπάρχει. */
  | { readonly kind: 'absent' }
  /** Το προφίλ δεν διαβάστηκε — καμία πρόταση από δεδομένα που δεν είδαμε. */
  | { readonly kind: 'unavailable' };

export async function readSelfContactState(companyId: string): Promise<SelfContactRead> {
  const db = getAdminFirestore();
  const company = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  if (!company.exists) return { kind: 'absent' };

  const link = selfContactOf(company.data());
  if (link !== null) {
    const contact = await db.collection(COLLECTIONS.CONTACTS).doc(link.contactId).get();
    return { kind: 'present', view: { linked: selfContactCandidateOf(link.contactId, contact.data()), suggestion: null } };
  }
  const tax = await readCompanyTaxDeclaration(companyId);
  if (tax.kind === 'unavailable') return { kind: 'unavailable' };
  const suggestion = await suggestSelfContact(companyId, tax.kind === 'present' ? tax.taxId : null);
  return { kind: 'present', view: { linked: null, suggestion } };
}
