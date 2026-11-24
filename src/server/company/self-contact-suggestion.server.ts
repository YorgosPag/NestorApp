import 'server-only';

/**
 * @fileoverview **Ποια επαφή είναι πιθανότατα ο χώρος;** — πρόταση από το ΑΦΜ του προφίλ (ADR-951 §3).
 * @module server/company/self-contact-suggestion.server
 *
 * 🔑 **Πρόταση, ποτέ απόφαση**: το ίδιο ΑΦΜ είναι ισχυρή ένδειξη, όχι απόδειξη (μια επαφή μπορεί να είναι λάθος
 *    καταχωρισμένη). Ο διαχειριστής επιβεβαιώνει· η σύνδεση γίνεται μόνο από τον γραφέα.
 * 🔑 Ερώτημα **μόνο με ισότητες** (`companyId` + `vatNumber`), όπως το `checkVatUniqueness` — καμία σάρωση, κανένας
 *    σύνθετος δείκτης. Το ΑΦΜ κανονικοποιείται με την ΕΝΑ κρίση (`greek-vat-number`).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { GREEK_VAT_REGEX, normalizeVat } from '@/lib/validation/greek-vat-number';
import { isInactiveContact } from '@/services/contact/platform-company-contact-resolver';
import type { SelfContactCandidate, SelfContactSuggestion } from '@/types/company-self-contact';

/** Αρκεί να ξέρουμε «ένα» ή «παραπάνω από ένα». */
const SUGGESTION_PROBE_LIMIT = 5;

/** Η επαφή όπως τη δείχνει η κάρτα — από ήδη διαβασμένο έγγραφο. */
export function selfContactCandidateOf(contactId: string, data: FirebaseFirestore.DocumentData | undefined): SelfContactCandidate {
  const displayName = typeof data?.displayName === 'string' ? data.displayName : '';
  const logoURL = typeof data?.logoURL === 'string' ? data.logoURL.trim() : '';
  return { contactId, displayName, hasOwnImage: logoURL !== '' };
}

/** Η πρόταση για τον χώρο `companyId`, από το ΑΦΜ του προφίλ του (`taxId`, ήδη διαβασμένο από τον καλούντα). */
export async function suggestSelfContact(companyId: string, taxId: string | null): Promise<SelfContactSuggestion> {
  const vat = taxId === null ? '' : normalizeVat(taxId);
  if (!GREEK_VAT_REGEX.test(vat)) return { kind: 'no-tax-id' };

  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .where('vatNumber', '==', vat)
    .limit(SUGGESTION_PROBE_LIMIT)
    .get();

  const candidates = snapshot.docs
    .filter((doc) => doc.data().type === 'company' && !isInactiveContact(doc.data()))
    .map((doc) => selfContactCandidateOf(doc.id, doc.data()));

  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length === 1) return { kind: 'suggested', candidate: candidates[0] };
  return { kind: 'ambiguous', candidates };
}
