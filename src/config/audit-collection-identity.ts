/**
 * **Ποιο στοιχείο είναι ποιο, και ποιο πεδίο είναι κάτοπτρο ποιου** — οι συλλογές της επαφής στο Ιστορικό
 * (ADR-195 (η), 2026-10-29).
 *
 * 🔑 **ΜΙΑ δήλωση, ΔΥΟ γραφείς.** Την διαβάζουν το `CONTACT_TRACKED_FIELDS` (`audit-tracked-fields.ts`, υπηρεσία)
 * **και** ο CDC (`functions/src/audit/contact-audit-trigger.ts`, ο πραγματικός γραφέας του Ιστορικού επαφών), μέσω
 * της προβολής του CHECK 3.93. Πριν, ο CDC δεν την έβλεπε και μάντευε.
 *
 * 🔴 **Η ΤΑΥΤΟΤΗΤΑ ΔΕΝ ΠΕΡΙΕΧΕΙ ΜΕΤΑΒΛΗΤΗ ΙΔΙΟΤΗΤΑ.** Αν το κλειδί περιέχει τον `type`, η αλλαγή τύπου αλλάζει την
 * ταυτότητα ⇒ «Αφαιρέθηκε» + «Προστέθηκε» αντί για **μία** αλλαγή ιδιότητας. Γι' αυτό οι διευθύνσεις ταυτίζονται με
 * το `id` τους (όπως του έργου, `ADDRESS_COLLECTION_DEF`) και όχι με `type|street|city|postalCode`.
 * ⚠️ Το `personas` δήλωνε `keyBy: ['type']` — το πεδίο λέγεται **`personaType`** ⇒ κάθε persona είχε κλειδί `""`
 * και ετικέτα «(άγνωστο)». Το ίδιο το `escoSkills` (`['code']` σε στοιχείο `{uri, label}`). Η άγκυρα
 * (`__tests__/audit-collection-identity.test.ts`) ελέγχει πλέον ότι κάθε `keyBy` είναι πραγματική ιδιότητα του στοιχείου.
 *
 * ⛔ **ΜΟΝΟ σχετικά imports προβαλλόμενων αρχείων** (κλειστότητα CHECK 3.93) — ποτέ `@/`.
 *
 * @module config/audit-collection-identity
 * @see ../lib/audit/collection-item-identity.ts — ο αλγόριθμος
 */

import type { CollectionIdentity } from '../lib/audit/collection-item-identity';

/** Οι συλλογές της επαφής: ταυτότητα (`keyBy`) + ετικέτα (`labelFields`) — χωρίς ωμό τύπο στην ετικέτα. */
export const CONTACT_COLLECTION_IDENTITY = {
  emails: { keyBy: 'email', labelFields: ['email'] },
  phones: { keyBy: 'number', labelFields: ['number'] },
  websites: { keyBy: 'url', labelFields: ['url'] },
  socialMedia: { keyBy: ['platform', 'username'], labelFields: ['platform', 'username'] },
  // Παράγωγο του `customFields.companyAddresses` (δες `CONTACT_DERIVED_MIRRORS`)· στοιχεία χωρίς `id` = παλιά έγγραφα.
  addresses: { keyBy: 'id', labelFields: ['type', 'street', 'city'] },
  // Η ΑΥΘΕΝΤΙΚΗ λίστα διευθύνσεων (`utils/contacts/contact-addresses-reader.ts`), ίδιο `id` με το κάτοπτρο.
  'customFields.companyAddresses': { keyBy: 'id', labelFields: ['type', 'street', 'city'] },
  children: { keyBy: 'value' },
  contactPersons: { keyBy: ['name', 'position'], labelFields: ['name', 'position'] },
  tags: { keyBy: 'value' },
  multiplePhotoURLs: { keyBy: 'value' },
  responsiblePersons: { keyBy: ['name', 'position'], labelFields: ['name', 'position'] },
  servicesProvided: { keyBy: 'value' },
  personas: { keyBy: 'personaType', labelFields: ['personaType'] },
  personaTypes: { keyBy: 'value' },
  // Αποθηκεύεται `{uri, label}` (`types/contacts/contracts.ts`)· το `uri` είναι κενό για ελεύθερο κείμενο ⇒ σύνθετο.
  // ⚠️ Δήλωνε `['code']` — πεδίο που ΔΕΝ υπάρχει ⇒ κάθε δεξιότητα έπεφτε στο κλειδί ολόκληρου JSON.
  escoSkills: { keyBy: ['uri', 'label'], labelFields: ['label'] },
} as const satisfies Readonly<Record<string, CollectionIdentity>>;

export type ContactCollectionField = keyof typeof CONTACT_COLLECTION_IDENTITY;

/**
 * **Παράγωγο → αυθεντία.** Το παράγωγο γράφεται από τον ίδιο γραφέα μαζί με την αυθεντία του· στο Ιστορικό η ίδια
 * αλλαγή θα εμφανιζόταν **δύο** φορές (μετρημένο στη MACON: η έδρα ως `addresses` **και** ως
 * `customFields.companyAddresses`, ο ρόλος ως `personas` **και** ως `personaTypes`). Πρακτική SAP change documents:
 * καταγράφεται η αυθεντία.
 *
 * ⚠️ Το παράγωγο σωπαίνει **μόνο όταν άλλαξε και η αυθεντία στην ίδια εγγραφή**. Παράγωγο που άλλαξε **μόνο του**
 * είναι απόκλιση κατόπτρου — ακριβώς αυτό που δεν πρέπει να κρυφτεί.
 */
export const CONTACT_DERIVED_MIRRORS: Readonly<Partial<Record<ContactCollectionField, ContactCollectionField>>> = {
  addresses: 'customFields.companyAddresses',
  // ADR-268 Q88 — `personaTypes` = τα ενεργά `personas[].personaType` (`contacts.service.ts`), ευρετήριο ερωτημάτων.
  personaTypes: 'personas',
};
