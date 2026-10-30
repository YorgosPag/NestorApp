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

const RETIRED_TRACKED_FIELDS: Readonly<Record<string, Readonly<Record<string, RetiredTrackedField>>>> = {
  property: { energy: ENERGY_AS_ONE_OBJECT },
  owner_property: { energy: ENERGY_AS_ONE_OBJECT },
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
