/**
 * @fileoverview **ΠΟΙΑ ΚΑΡΤΕΛΑ ΕΙΝΑΙ «ΔΙΕΥΘΥΝΣΕΙΣ»** για κάθε είδος επαφής — η ΜΙΑ απάντηση (ADR-950 §8.9).
 * @module config/contact-address-section
 *
 * 🔴 2026-11-23 (ζωντανός έλεγχος): η «Πρόταση διεύθυνσης» σε φυσικό πρόσωπο άνοιγε τα «Βασικά Στοιχεία». Ο καλών ζητούσε
 * πάντα `addresses` (το id της **εταιρείας**)· το φυσικό πρόσωπο και η υπηρεσία έχουν `address`. Ο φλοιός καρτελών
 * (`form-tabs-shell`) δέχεται μόνο id που υπάρχει ⇒ έπεφτε στην πρώτη καρτέλα, σιωπηλά.
 */

import { COMPANY_ADDRESSES_SECTION_ID } from '@/config/company-gemi/core/section-registry';
import { INDIVIDUAL_ADDRESS_SECTION_ID } from '@/config/individual-config';
import { SERVICE_ADDRESS_SECTION_ID } from '@/config/service-config';
import type { ContactType } from '@/types/contacts/contracts';

const ADDRESS_SECTION_ID: Readonly<Record<ContactType, string>> = {
  individual: INDIVIDUAL_ADDRESS_SECTION_ID,
  company: COMPANY_ADDRESSES_SECTION_ID,
  service: SERVICE_ADDRESS_SECTION_ID,
};

/** Το id της καρτέλας διευθύνσεων του είδους επαφής. */
export function addressSectionIdFor(contactType: ContactType): string {
  return ADDRESS_SECTION_ID[contactType];
}
