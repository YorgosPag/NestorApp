/**
 * @fileoverview **Επαφή → στοιχεία συναλλασσόμενου** — μία φορά, για κάθε φόρμα του λογιστικού.
 * @related CLAUDE.md N.0.2 / N.18 (CHECK 3.28) · `@/types/contacts/helpers` (getPrimary*)
 *
 * 🔴 **Γιατί υπάρχει**: η ίδια αντιστοίχιση ζούσε **δύο φορές**, στο `CustomerSelector`
 * (πελάτης τιμολογίου) και στο `BasicInfoSection` (στοιχεία εταιρείας), η καθεμία με δικό
 * της `findPrimary` + `extractStreet`, και μέσα στο δεύτερο **άλλες δύο φορές** (φυσικό/νομικό
 * πρόσωπο). Το CHECK 3.28 το είδε όταν τα δύο αρχεία άλλαξαν μαζί (2026-09-21).
 *
 * 🔑 **Το «κύριο» στοιχείο το αποφασίζει το SSoT των επαφών**, όχι αντίγραφο εδώ:
 * `getPrimaryAddress` / `getPrimaryPhone` / `getPrimaryEmail`. ⚠️ Συνέπεια, σκόπιμη: σε
 * **δημόσια υπηρεσία** χωρίς πίνακα τηλεφώνων/email διαβάζονται πλέον και τα παλαιά πεδία της
 * (`centralPhone`, `officialEmail`…), όπως σε κάθε άλλη οθόνη. Πριν έμεναν κενά.
 *
 * Ό,τι διαφέρει ανά φόρμα (κενό = `''` ή `null`, προεπιλεγμένη χώρα) μένει στη φόρμα.
 */

import {
  getPrimaryAddress,
  getPrimaryEmail,
  getPrimaryPhone,
  isCompanyContact,
  isIndividualContact,
  type AddressInfo,
  type Contact,
} from '@/types/contacts';

export interface ContactParty {
  readonly name: string;
  /** Μόνο φυσικό πρόσωπο έχει επάγγελμα· αλλιώς `null` («δεν ισχύει», όχι «κενό»). */
  readonly profession: string | null;
  /** `false` για δημόσια υπηρεσία: δεν έχει ΑΦΜ/ΔΟΥ που να αντιγράφεται. */
  readonly hasTaxIdentity: boolean;
  readonly vatNumber: string | null;
  readonly taxOffice: string | null;
  /** Οδός + αριθμός, ή `''`. */
  readonly street: string;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

function extractStreet(address: AddressInfo | undefined): string {
  if (!address) return '';
  return address.number ? `${address.street} ${address.number}` : address.street;
}

export function extractContactParty(contact: Contact): ContactParty {
  const address = getPrimaryAddress(contact);
  const common = {
    street: extractStreet(address),
    city: address?.city ?? null,
    postalCode: address?.postalCode ?? null,
    country: address?.country ?? null,
    phone: getPrimaryPhone(contact) ?? null,
    email: getPrimaryEmail(contact) ?? null,
  };

  if (isIndividualContact(contact)) {
    return {
      ...common,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      profession: contact.profession ?? '',
      hasTaxIdentity: true,
      vatNumber: contact.vatNumber ?? null,
      taxOffice: contact.taxOffice ?? null,
    };
  }
  if (isCompanyContact(contact)) {
    return {
      ...common,
      name: contact.companyName,
      profession: null,
      hasTaxIdentity: true,
      vatNumber: contact.vatNumber ?? null,
      taxOffice: contact.taxOffice ?? null,
    };
  }
  return {
    ...common,
    name: contact.serviceName,
    profession: null,
    hasTaxIdentity: false,
    vatNumber: null,
    taxOffice: null,
  };
}
