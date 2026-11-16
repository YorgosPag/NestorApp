/**
 * 🪦 Πεδία που ΑΠΟΣΥΡΘΗΚΑΝ από τον γραφέα αλλά ζουν σε ήδη γραμμένες γραμμές Ιστορικού — ADR-195 (κ) · ADR-852 §3.1
 *
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ: *«αυτή η παλιά γραμμή, για πεδίο που ο γραφέας ΔΕΝ γράφει πια, με ποιες λέξεις διαβάζεται;»*
 *
 * Πρακτική SAP change documents: όταν ένα πεδίο αποσύρεται, τα ήδη γραμμένα έγγραφα αλλαγών **κρατούν** το domain του
 * για την προβολή — το ιστορικό είναι αμετάβλητο, η ανάγνωση το θεραπεύει (ADR-852 §3.1). Χωρίς αυτό η παλιά γραμμή
 * `energy: — → {"class":"A"}` (πριν το ADR-777 §8.94 έσπασε το ΠΕΑ σε `energy.<πεδίο>`) έδειχνε τα κλειδιά ωμά.
 *
 * ⚠️ **ΜΟΝΟ ΑΝΑΓΝΩΣΗ — ΧΩΡΙΣΤΟ ΜΗΤΡΩΟ ΕΠΙΤΗΔΕΣ.** Ο γραφέας διαβάζει το `getTrackedFieldsForEntityAuditType`· αν το
 * `energy` γραφόταν εκεί, θα ξανάρχιζε να καταγράφεται ΟΛΟ το αντικείμενο δίπλα στα `energy.*` (διπλές γραμμές). Η άγκυρα
 * απαιτεί κάθε αποσυρμένο πεδίο να **λείπει** από το ενεργό μητρώο, και να λέει **από ποιο ADR** αποσύρθηκε.
 *
 * @module config/audit-retired-fields
 */

import type { TrackedFieldDef } from '@/lib/audit/tracked-field-def';
import { AUDIT_ENERGY_CERTIFICATE_KEY_CATALOG } from '@/config/audit-value-vocabularies';

export interface RetiredTrackedField {
  /** Ο περιγραφέας ανάγνωσης: ετικέτα + λεξιλόγια, όπως ίσχυαν όταν γράφτηκαν οι γραμμές. */
  readonly def: TrackedFieldDef;
  /** Πού και γιατί αποσύρθηκε — ο επόμενος πρέπει να ξέρει τι το αντικατέστησε. */
  readonly retiredBy: string;
}

/** Το ΠΕΑ ως ΕΝΙΑΙΟ αντικείμενο — τα κλειδιά του έχουν τις λέξεις των σημερινών `energy.<πεδίο>`. */
const ENERGY_AS_ONE_OBJECT: RetiredTrackedField = {
  retiredBy: 'ADR-777 §8.94 — αντικαταστάθηκε από ένα πεδίο ανά τιμή του ΠΕΑ (`energy.class`, `energy.issuedOn`…)',
  def: {
    kind: 'scalar',
    // Η ετικέτα λύνεται από το `audit.fields.energy` (ειδικό/γενικό επίπεδο) — δεν χρειάζεται `labelKey`.
    label: 'energy',
    nestedKeyCatalog: AUDIT_ENERGY_CERTIFICATE_KEY_CATALOG,
  },
};

/**
 * Η πρόσκληση στον χώρο της ανάθεσης ως ΕΝΑ πεδίο για όλα τα είδη (ADR-915 §39). Ετικέτα από το
 * `audit.fields.issuanceSpaceInvitation`· η τιμή `invited:<email>` λύνεται από τον κατάλογο του ονόματος
 * (`audit-value-catalogs.ts`) — ο ίδιος με τα νέα πεδία ανά είδος.
 */
const SPACE_INVITATION_FOR_ALL_KINDS: RetiredTrackedField = {
  retiredBy: 'ADR-915 §45.21.2 — αντικαταστάθηκε από ένα πεδίο ανά είδος (`ISSUANCE_AUDIT_FIELDS[είδος].spaceInvitation`)',
  def: { kind: 'scalar', label: 'issuanceSpaceInvitation' },
};

const PROPERTY_RETIRED_FIELDS: Readonly<Record<string, RetiredTrackedField>> = {
  energy: ENERGY_AS_ONE_OBJECT,
  issuanceSpaceInvitation: SPACE_INVITATION_FOR_ALL_KINDS,
};

const RETIRED_TRACKED_FIELDS: Readonly<Record<string, Readonly<Record<string, RetiredTrackedField>>>> = {
  property: PROPERTY_RETIRED_FIELDS,
  owner_property: PROPERTY_RETIRED_FIELDS,
};

/** Τα αποσυρμένα πεδία ενός τύπου οντότητας (κενό αν δεν έχει) — μόνο own-property, ποτέ `constructor`. */
export function getRetiredTrackedFields(entityType: string | null): Readonly<Record<string, RetiredTrackedField>> {
  if (entityType === null || !Object.prototype.hasOwnProperty.call(RETIRED_TRACKED_FIELDS, entityType)) return {};
  return RETIRED_TRACKED_FIELDS[entityType];
}

/** Ο περιγραφέας ανάγνωσης ενός αποσυρμένου πεδίου, αν υπάρχει. */
export function getRetiredFieldDef(entityType: string | null, field: string): TrackedFieldDef | undefined {
  const retired = getRetiredTrackedFields(entityType);
  return Object.prototype.hasOwnProperty.call(retired, field) ? retired[field].def : undefined;
}
