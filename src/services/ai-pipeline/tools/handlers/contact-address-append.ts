/**
 * @module services/ai-pipeline/tools/handlers/contact-address-append
 * @enterprise ADR-332 §D30 Φάση 2 · ADR-332 D15/D18/D20 · ADR-319
 *
 * **Ο AI πράκτορας προσθέτει διεύθυνση στην ΑΥΘΕΝΤΙΚΗ λίστα — όχι στο παράγωγο.**
 *
 * 🔴 Ως τη Φάση 2 το `append_contact_info` (uc-016) έγραφε **μόνο** στο `addresses[]`. Η αλήθεια
 * όμως ζει στο `customFields.companyAddresses` (ADR-332 D18) και το `addresses[]` παράγεται από
 * αυτή (D15). Η φόρμα διαβάζει πρώτα τη λίστα ⇒ η διεύθυνση που πρόσθεσε ο πράκτορας **δεν
 * φαινόταν** σε επαφή με λίστα, και η επόμενη αποθήκευση από την οθόνη την **έσβηνε**.
 *
 * Εδώ: ανάγνωση με τον **ίδιο** reader της φόρμας (`resolveContactAddresses`), νέα εγγραφή με
 * ταυτότητα (`generateAddressId`, N.6), και εγγραφή **και των δύο** από την ίδια λίστα, με τον
 * **ίδιο** builder του saver. Η λίστα γράφεται ως διαδρομή πεδίου, ώστε τα υπόλοιπα `customFields`
 * (ΚΑΔ, ΓΕΜΗ, …) να μένουν άθικτα (ADR-332 D27 Φ0).
 */

import type { Contact } from '@/types/contacts';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { getDefaultSecondaryAddressType, getPrimaryAddressType } from '@/types/contacts/address-types';
import { generateAddressId } from '@/services/enterprise-id.service';
import { buildAddressInfoListFromCompanyAddresses } from '@/utils/contacts/address-info-builder';
import { resolveContactAddresses } from '@/utils/contacts/contact-addresses-reader';
import { pruneBlankContactAddresses } from '@/utils/contacts/contact-address-blankness';
import { ADDRESS_LABEL_MAP, type parseGreekAddress } from './address-parser';

type ParsedAddress = ReturnType<typeof parseGreekAddress>;

/**
 * Ο τύπος ADR-319 της νέας εγγραφής. Θέση 0 ⇒ ο κύριος τύπος του είδους· αλλιώς ο δευτερεύων.
 * Ετικέτα «αποστολής» / «χρέωσης» δεν έχει σημασιολογικό slug στο ADR-319 ⇒ `other` + η ετικέτα
 * του ανθρώπου, ώστε να μη χαθεί (ως τη Φάση 2 ζούσε μόνο ως ταχυδρομικό είδος του παράγωγου).
 */
function addedAddressType(
  kind: Contact['type'] | undefined,
  isFirst: boolean,
  label: string,
): Pick<CompanyAddress, 'type' | 'customLabel'> {
  if (isFirst) return { type: getPrimaryAddressType(kind) };
  const postal = Object.prototype.hasOwnProperty.call(ADDRESS_LABEL_MAP, label) ? ADDRESS_LABEL_MAP[label] : undefined;
  if (postal === 'shipping' || postal === 'billing') return { type: 'other', customLabel: label };
  return { type: getDefaultSecondaryAddressType(kind) };
}

/** Το είδος επαφής του εγγράφου, όπως το ξέρει το λεξιλόγιο ADR-319. */
function contactKindOf(contactData: Readonly<Record<string, unknown>>): Contact['type'] | undefined {
  const type = contactData.type;
  return type === 'company' || type === 'individual' || type === 'service' ? type : undefined;
}

/**
 * Τα πεδία ενημέρωσης για την προσθήκη μιας διεύθυνσης: `customFields.companyAddresses` (αυθεντικό)
 * και `addresses` (παράγωγο), από την **ίδια** κλαδεμένη λίστα. Καθαρή συνάρτηση.
 *
 * - Κενές εγγραφές της υπάρχουσας λίστας κλαδεύονται με την ΙΔΙΑ δικλείδα του saver (D20): μόνη
 *   κενή έδρα ⇒ η νέα διεύθυνση γίνεται έδρα, αντί να μείνει για πάντα πίσω από ένα κενό.
 * - Η νέα εγγραφή γίνεται έδρα αν η λίστα είναι άδεια, αλλιώς δευτερεύουσα — με τον τύπο ADR-319
 *   **του είδους** της επαφής (εταιρεία → έδρα/υποκατάστημα, φυσικό πρόσωπο → κατοικία, …).
 */
export function buildContactAddressAppendPatch(
  contactData: Readonly<Record<string, unknown>>,
  parsed: ParsedAddress,
  label = '',
): Record<string, unknown> {
  const kind = contactKindOf(contactData);
  const current = pruneBlankContactAddresses(resolveContactAddresses(contactData as unknown as Contact, kind));
  const added: CompanyAddress = {
    id: generateAddressId(),
    ...addedAddressType(kind, current.length === 0, label),
    street: parsed.street,
    number: parsed.number,
    postalCode: parsed.postalCode,
    city: parsed.city,
    country: parsed.country || 'GR',
  };
  const list = [...current, added];
  return {
    'customFields.companyAddresses': list,
    addresses: buildAddressInfoListFromCompanyAddresses(list),
  };
}
