/**
 * @fileoverview **Η ΟΨΗ ΘΕΣΗΣ** μιας διεύθυνσης επαφής — ό,τι βλέπει ο ένας γραφέας θέσης.
 * @module utils/contacts/contact-address-position-view
 * @enterprise ADR-332 D27 Βήμα Β-ΙΙ · ADR-772 (ένα λεξιλόγιο)
 *
 * 🔑 **Γιατί υπάρχει.** Ο γραφέας (`lib/geocoding/address-position`) κρίνει ταυτότητα με τα
 * ονόματα του **έργου** (`municipality`, `regionalUnit`, `region`), ενώ η επαφή τα λέει
 * `municipalityName` / `regionalUnitName` / `regionName`. Αν η διεύθυνση επαφής περνούσε
 * αυτούσια, η γεωκωδικοποίηση θα έχανε τη διάκριση δήμου που έχει σήμερα ο χάρτης — η
 * πινέζα θα έπεφτε αλλού απ' ό,τι δείχνει η οθόνη.
 *
 * ⚠️ **ΜΙΑ συνάρτηση, δύο πλευρές**: ο διακομιστής τη ρωτά για τις **αποθηκευμένες**, ο
 * πελάτης για τις **εισερχόμενες**. Δύο αντιγραφές θα διαφωνούσαν για το «άλλαξε το
 * κείμενο;» — και η διαφωνία = άσκοπη γεωκωδικοποίηση ή, χειρότερα, σβησμένη πινέζα.
 * Η αντιστοίχιση περνά από το `projectAddressVocabulary` (ADR-772: καμία χειρόγραφη).
 *
 * 🔑 Η διαδρομή επιστρέφει **μόνο αποφάσεις θέσης** ανά `id`· ο πελάτης τις εφαρμόζει στη
 * δική του πλήρη εγγραφή (`applyContactAddressPosition`). Έτσι κανένα σχήμα συνόρου δεν
 * μπορεί να κόψει κείμενο ή ιεραρχία (το μάθημα του ADR-759 Φ3).
 */

import {
  ADDRESS_IDENTITY_FIELDS,
  type AddressIdentityField,
  type AddressPositionDrift,
} from '@/lib/geocoding/address-position';
import type { StoredAddressPosition } from '@/types/address-position';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { projectAddressVocabulary } from '@/utils/address/administrative-hierarchy';
import { pickStoredAddressPosition } from '@/utils/address/stored-address-position';

type IdentityText = { [K in AddressIdentityField]?: string };

/** Ό,τι ταξιδεύει προς τον γραφέα: ταυτότητα εγγραφής + κείμενο ταυτότητας + θέση. */
export type ContactAddressPositionView = StoredAddressPosition & IdentityText & { readonly id: string };

/** Η απόφαση του γραφέα για **μία** εγγραφή — απουσία πεδίων θέσης = «καμία θέση». */
export interface ContactAddressPositionDecision extends StoredAddressPosition {
  readonly id: string;
}

export interface ContactAddressPositionsRequest {
  readonly addresses: readonly ContactAddressPositionView[];
  /** «Μετακίνησε στη θέση της διεύθυνσης» (Φ2β) — ανά ταυτότητα, ποτέ ανά δείκτη. */
  readonly relocateAddressIds?: readonly string[];
}

export interface ContactAddressPositionsResponse {
  readonly positions: readonly ContactAddressPositionDecision[];
  readonly positionAdvisories: readonly AddressPositionDrift[];
}

export function contactAddressPositionView(
  address: CompanyAddress & { readonly id: string },
): ContactAddressPositionView {
  const bag = projectAddressVocabulary(
    address as Readonly<Record<string, unknown>>,
    'companyAddress',
    'projectAddress',
    { includePostal: true, clearedIdsAsNull: false },
  );
  const identity: IdentityText = {};
  for (const field of ADDRESS_IDENTITY_FIELDS) {
    const value = bag[field];
    if (typeof value === 'string' && value !== '') identity[field] = value;
  }
  return { id: address.id, ...identity, ...pickStoredAddressPosition(address) };
}

/**
 * Οι όψεις μιας λίστας. Εγγραφή **χωρίς** `id` (παλιό έγγραφο) δεν μπορεί να ταιριάξει με
 * τίποτα, οπότε δεν στέλνεται — ο saver δίνει ταυτότητα σε κάθε εγγραφή πριν τη διαδρομή.
 */
export function contactAddressPositionViews(
  addresses: readonly CompanyAddress[],
): ContactAddressPositionView[] {
  return addresses.flatMap((address) =>
    address.id ? [contactAddressPositionView({ ...address, id: address.id })] : [],
  );
}

/**
 * Εφαρμόζει την απόφαση πάνω στην **πλήρη** εγγραφή του πελάτη — τα τέσσερα πεδία θέσης
 * αντικαθίστανται **μαζί** (ίδιος κανόνας με το `applyAddressPosition`): ό,τι λείπει από
 * την απόφαση **αφαιρείται**, δεν μένει μπαγιάτικο.
 */
export function applyContactAddressPosition(
  address: CompanyAddress,
  decision: Readonly<StoredAddressPosition>,
): CompanyAddress {
  const next: CompanyAddress = { ...address };
  delete next.coordinates;
  delete next.geocodingMetadata;
  delete next.source;
  delete next.verifiedAt;
  return { ...next, ...pickStoredAddressPosition(decision) };
}
