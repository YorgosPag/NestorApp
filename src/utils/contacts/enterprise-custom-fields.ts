/**
 * Company-only `customFields` catalog (SSoT)
 *
 * Εξήχθη από το `EnterpriseContactSaver.convertToEnterpriseStructure`, που είχε
 * ξεπεράσει τις 200 γραμμές (N.7.1). Ο διαχωρισμός δεν είναι μόνο μεγέθους:
 * κάνει ορατή τη διάκριση που έλειπε και προκάλεσε το ελάττωμα του ADR-332 D18
 * — **ποια** πεδία ανήκουν πράγματι μόνο σε εταιρείες (ΓΕΜΗ, ΚΑΔ, κεφάλαιο) και
 * ποια είχαν απλώς βρεθεί στο ίδιο `if (type === 'company')` μπλοκ χωρίς να
 * ανήκουν εκεί (η λίστα διευθύνσεων).
 *
 * @module utils/contacts/enterprise-custom-fields
 * @see ADR-332 D18
 */

import type { ContactFormData } from '@/types/ContactFormTypes';

/**
 * Πεδία εταιρείας που ζουν στα `customFields` του Firestore εγγράφου.
 *
 * ⚠️ Το `municipality` είναι εδώ **σκοπίμως**: για εταιρείες κρατιέται ως πεδίο
 * ΓΕΜΗ. Γι' αυτό η αφαίρεσή του από το top level πρέπει να μείνει κλειδωμένη
 * στον κλάδο εταιρείας — σε φυσικό πρόσωπο ή υπηρεσία το ίδιο όνομα είναι
 * επίπεδο της **διοικητικής ιεραρχίας** και η διαγραφή του θα έσβηνε διεύθυνση.
 */
const COMPANY_CUSTOM_FIELD_KEYS = [
  'gemiStatus', 'gemiStatusDate',
  'activityCodeKAD', 'activityDescription', 'activityType',
  'chamber', 'capitalAmount', 'currency', 'extraordinaryCapital',
  'registrationDate', 'lastUpdateDate',
  'gemiDepartment', 'prefecture', 'municipality',
] as const;

/**
 * Top-level πεδία που αφαιρούνται από το payload εταιρείας επειδή η κανονική
 * τους θέση είναι μέσα στα `customFields`.
 *
 * Το `companyAddresses` **δεν** είναι εδώ: αφαιρείται για κάθε είδος επαφής,
 * όχι μόνο για εταιρείες (ADR-332 D18).
 */
export const COMPANY_ONLY_TOP_LEVEL_FIELDS: readonly string[] = [
  'activities',
  ...COMPANY_CUSTOM_FIELD_KEYS,
];

/** Τα `customFields` που προκύπτουν από φόρμα εταιρείας (χωρίς τις διευθύνσεις). */
export function collectCompanyCustomFields(
  formData: Partial<ContactFormData>,
): Record<string, unknown> {
  const customFields: Record<string, unknown> = {};

  // Multi-KAD activities — `[]` είναι έγκυρη τιμή (καθαρίζει τα παλιά)
  if (formData.activities !== undefined) {
    customFields.activities = formData.activities ?? [];
  }

  for (const key of COMPANY_CUSTOM_FIELD_KEYS) {
    if (formData[key] !== undefined) {
      customFields[key] = formData[key];
    }
  }

  return customFields;
}
