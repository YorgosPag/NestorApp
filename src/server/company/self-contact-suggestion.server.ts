import 'server-only';

/**
 * @fileoverview **Ποια επαφή είναι πιθανότατα ο χώρος;** — πρόταση από το ΑΦΜ του προφίλ (ADR-951 §3).
 * @module server/company/self-contact-suggestion.server
 *
 * 🔑 **Πρόταση, ποτέ απόφαση**: το ίδιο ΑΦΜ είναι ισχυρή ένδειξη, όχι απόδειξη (μια επαφή μπορεί να είναι λάθος
 *    καταχωρισμένη). Ο διαχειριστής επιβεβαιώνει· η σύνδεση γίνεται μόνο από τον γραφέα.
 * 🔑 Η ερώτηση «ποιες επαφές έχουν αυτό το ΑΦΜ» είναι η ΜΙΑ του server (`findContactVatHolders`) — η ίδια που φράζει
 *    τη δημιουργία διπλής επαφής στον γραφέα. Η πρόταση κρατά μόνο ό,τι **μπορεί** να συνδεθεί: εταιρείες εκτός
 *    αρχείου (ο κάδος έχει ήδη αποκλειστεί από την ερώτηση, ADR-944 §9.7).
 * 🔑 Το όνομα από τον ΕΝΑ αναγνώστη ωμού εγγράφου (`extractContactDisplayName`): οι επαφές-εταιρείες κρατούν το όνομα
 *    στο `companyName` — το `displayName` το έχουν μόνο όσες έγραψε ο `buildContactDocument` (ζωντανό σφάλμα 2026-11-24).
 */

import { GREEK_VAT_REGEX, normalizeVat } from '@/lib/validation/greek-vat-number';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { findContactVatHolders } from '@/server/lib/contact-vat-holders.server';
import type { SelfContactCandidate, SelfContactSuggestion } from '@/types/company-self-contact';

/** Η επαφή όπως τη δείχνει η κάρτα — από ήδη διαβασμένο έγγραφο (ανύπαρκτο ⇒ κενό όνομα, το id μένει). */
export function selfContactCandidateOf(contactId: string, data: FirebaseFirestore.DocumentData | undefined): SelfContactCandidate {
  const displayName = data === undefined ? '' : extractContactDisplayName(data).trim();
  const logoURL = typeof data?.logoURL === 'string' ? data.logoURL.trim() : '';
  return { contactId, displayName, hasOwnImage: logoURL !== '' };
}

/** Η πρόταση για τον χώρο `companyId`, από το ΑΦΜ του προφίλ του (`taxId`, ήδη διαβασμένο από τον καλούντα). */
export async function suggestSelfContact(companyId: string, taxId: string | null): Promise<SelfContactSuggestion> {
  const vat = taxId === null ? '' : normalizeVat(taxId);
  if (!GREEK_VAT_REGEX.test(vat)) return { kind: 'no-tax-id' };

  const candidates = (await findContactVatHolders(companyId, vat))
    .filter((holder) => holder.type === 'company' && !holder.archived)
    .map((holder) => selfContactCandidateOf(holder.id, holder.data));

  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length === 1) return { kind: 'suggested', candidate: candidates[0] };
  return { kind: 'ambiguous', candidates };
}
