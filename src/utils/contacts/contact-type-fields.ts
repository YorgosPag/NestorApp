/**
 * Contact Type-Exclusive Field Catalog (SSoT)
 *
 * Defines which top-level Firestore fields are exclusive to each contact type.
 * Used by `EnterpriseContactSaver` to strip form-default values that don't
 * belong to the contact's type before writing to Firestore.
 *
 * Problem solved: `ContactFormData` is a unified type with fields for ALL three
 * contact types. Default values (e.g. `serviceType: 'other'`, `isBranch: false`,
 * `activityType: 'main'`) get initialized for every contact regardless of type.
 * Without this filter, photo uploads and other partial saves write these
 * irrelevant defaults to Firestore, causing CDC to emit noisy audit events.
 *
 * @module utils/contacts/contact-type-fields
 * @enterprise ADR-195 — Entity Audit Trail (CDC noise reduction)
 */

// =============================================================================
// ΟΜΑΔΕΣ ΠΕΔΙΩΝ — κάθε ομάδα γράφεται ΜΙΑ φορά
// =============================================================================
//
// Οι τρεις λίστες ήταν γραμμένες αυτούσιες, με τα ίδια μπλοκ αντιγραμμένα σε
// δύο από αυτές. Ένα νέο πεδίο ταυτότητας έπρεπε να προστεθεί σε δύο σημεία και
// μια ξεχασμένη προσθήκη περνούσε αθόρυβα (N.18 — το `jscpd` το βλέπει, το
// `ssot:discover` όχι: ίδιο περιεχόμενο, άλλο όνομα σταθεράς).
//
// ⚠️ Οι διαφορές μεταξύ των λιστών είναι ΠΡΑΓΜΑΤΙΚΕΣ, όχι αβλεψίες: το
// `prefecture` απαγορεύεται σε φυσικό πρόσωπο αλλά ΟΧΙ σε εταιρεία (εκεί είναι
// πεδίο ΓΕΜΗ), και το `legalForm` απαγορεύεται σε φυσικό πρόσωπο αλλά ΟΧΙ σε
// υπηρεσία. Η σύνθεση παρακάτω τις διατηρεί ακριβώς.

/** Ταυτότητα φυσικού προσώπου. */
const INDIVIDUAL_IDENTITY = [
  'firstName', 'lastName', 'fatherName', 'motherName',
  'birthDate', 'birthCountry', 'gender', 'amka',
  'documentType', 'documentNumber', 'documentIssuer', 'documentIssueDate', 'documentExpiryDate',
  'personas', 'employer', 'employerId', 'position', 'workAddress', 'workWebsite',
  'escoUri', 'escoLabel', 'iscoCode', 'escoSkills',
] as const;

/** Ταυτότητα δημόσιας υπηρεσίας. */
const SERVICE_IDENTITY = [
  'serviceName', 'serviceType', 'serviceCode', 'shortName',
  'category', 'supervisionMinistry', 'legalStatus', 'establishmentLaw',
  'headTitle', 'headName', 'serviceVatNumber', 'serviceTaxOffice', 'serviceTitle',
] as const;

/** Διοικητικά πεδία υπηρεσίας — κοινά σε όσους ΔΕΝ είναι υπηρεσία. */
const SERVICE_ADMIN = [
  'isBranch', 'registrationMethod', 'registrationDate', 'lastUpdateDate',
  'parentMinistry', 'serviceCategory', 'officialWebsite',
  'mainResponsibilities', 'citizenServices', 'onlineServices', 'serviceHours', 'serviceAddress',
] as const;

/** Μητρώο ΓΕΜΗ + δραστηριότητες ΚΑΔ (εταιρεία & υπηρεσία). */
const REGISTRY_AND_ACTIVITY = [
  'gemiNumber', 'gemiStatus', 'gemiStatusDate', 'gemiDepartment',
  'chamber', 'capitalAmount', 'currency', 'extraordinaryCapital',
  'activityType', 'activityCodeKAD', 'activityDescription',
  'activityValidFrom', 'activityValidTo', 'activities',
] as const;

/**
 * Δομή εταιρείας.
 *
 * ⚠️ Το `companyAddresses` ΔΕΝ είναι εδώ (ADR-332 D18): η λίστα διευθύνσεων
 * είναι νόμιμη για κάθε είδος επαφής — το ADR-319 ορίζει ρητά `home`/`office`/
 * `vacation` για φυσικά πρόσωπα και `regional_service`/`annex`/`department` για
 * υπηρεσίες. Όσο ήταν απαγορευμένο, το UI δεχόταν επιπλέον διευθύνσεις και το
 * save τις πετούσε σιωπηλά. Την αφαίρεση του top-level αντιγράφου την κάνει
 * πλέον ο `EnterpriseContactSaver` για όλους τους τύπους, αφού πρώτα τις
 * μεταφέρει στα `customFields`.
 */
const COMPANY_STRUCTURE = ['shareholders', 'branches'] as const;

// =============================================================================
// ΣΥΝΘΕΣΗ ΑΝΑ ΕΙΔΟΣ ΕΠΑΦΗΣ
// =============================================================================

/** Fields that must never be written for `individual` contacts. */
const FORBIDDEN_FOR_INDIVIDUAL: readonly string[] = [
  'companyName', 'tradeName', 'legalForm', 'companyVatNumber',
  ...REGISTRY_AND_ACTIVITY,
  ...COMPANY_STRUCTURE,
  ...SERVICE_IDENTITY,
  ...SERVICE_ADMIN,
  // Νομαρχία: πεδίο ΓΕΜΗ/υπηρεσίας — δεν αφορά φυσικό πρόσωπο.
  'prefecture',
];

/** Fields that must never be written for `company` contacts. */
const FORBIDDEN_FOR_COMPANY: readonly string[] = [
  ...INDIVIDUAL_IDENTITY,
  ...SERVICE_IDENTITY,
  ...SERVICE_ADMIN,
];

/** Fields that must never be written for `service` contacts. */
const FORBIDDEN_FOR_SERVICE: readonly string[] = [
  ...INDIVIDUAL_IDENTITY,
  // Χωρίς `legalForm`: η υπηρεσία έχει δική της νομική μορφή (`legalStatus`),
  // αλλά το `legalForm` δεν απαγορεύεται ρητά — διατηρείται η ισχύουσα λίστα.
  'companyName', 'tradeName', 'companyVatNumber',
  ...COMPANY_STRUCTURE,
];

const FORBIDDEN_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  individual: FORBIDDEN_FOR_INDIVIDUAL,
  company: FORBIDDEN_FOR_COMPANY,
  service: FORBIDDEN_FOR_SERVICE,
};

/**
 * Remove fields that don't belong to `contactType` from `data`.
 *
 * Pure function — returns a new object, does not mutate `data`.
 * No-op for unknown contact types.
 */
export function stripTypeExclusiveFields(
  data: Record<string, unknown>,
  contactType: string | undefined,
): Record<string, unknown> {
  if (!contactType) return data;
  const forbidden = FORBIDDEN_BY_TYPE[contactType];
  if (!forbidden || forbidden.length === 0) return data;

  const result = { ...data };
  for (const field of forbidden) {
    delete result[field];
  }
  return result;
}
