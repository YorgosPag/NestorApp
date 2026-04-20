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

/** Fields that must never be written for `individual` contacts. */
const FORBIDDEN_FOR_INDIVIDUAL: readonly string[] = [
  // Company identity
  'companyName', 'tradeName', 'legalForm', 'companyVatNumber',
  // GEMI / registry data (company + service)
  'gemiNumber', 'gemiStatus', 'gemiStatusDate', 'gemiDepartment',
  'chamber', 'capitalAmount', 'currency', 'extraordinaryCapital',
  // Activity / KAD (company + service)
  'activityType', 'activityCodeKAD', 'activityDescription',
  'activityValidFrom', 'activityValidTo', 'activities',
  // Company structure
  'shareholders', 'branches', 'companyAddresses',
  // Service identity
  'serviceName', 'serviceType', 'serviceCode', 'shortName',
  'category', 'supervisionMinistry', 'legalStatus', 'establishmentLaw',
  'headTitle', 'headName', 'serviceVatNumber', 'serviceTaxOffice', 'serviceTitle',
  // Service admin
  'isBranch', 'registrationMethod', 'registrationDate', 'lastUpdateDate', 'prefecture',
  'parentMinistry', 'serviceCategory', 'officialWebsite',
  'mainResponsibilities', 'citizenServices', 'onlineServices', 'serviceHours', 'serviceAddress',
];

/** Fields that must never be written for `company` contacts. */
const FORBIDDEN_FOR_COMPANY: readonly string[] = [
  // Individual identity
  'firstName', 'lastName', 'fatherName', 'motherName',
  'birthDate', 'birthCountry', 'gender', 'amka',
  'documentType', 'documentNumber', 'documentIssuer', 'documentIssueDate', 'documentExpiryDate',
  'personas', 'employer', 'employerId', 'position', 'workAddress', 'workWebsite',
  'escoUri', 'escoLabel', 'iscoCode', 'escoSkills',
  // Service-only identity
  'serviceName', 'serviceType', 'serviceCode', 'shortName',
  'category', 'supervisionMinistry', 'legalStatus', 'establishmentLaw',
  'headTitle', 'headName', 'serviceVatNumber', 'serviceTaxOffice', 'serviceTitle',
  'isBranch', 'registrationMethod', 'registrationDate', 'lastUpdateDate',
  'parentMinistry', 'serviceCategory', 'officialWebsite',
  'mainResponsibilities', 'citizenServices', 'onlineServices', 'serviceHours', 'serviceAddress',
];

/** Fields that must never be written for `service` contacts. */
const FORBIDDEN_FOR_SERVICE: readonly string[] = [
  // Individual identity
  'firstName', 'lastName', 'fatherName', 'motherName',
  'birthDate', 'birthCountry', 'gender', 'amka',
  'documentType', 'documentNumber', 'documentIssuer', 'documentIssueDate', 'documentExpiryDate',
  'personas', 'employer', 'employerId', 'position', 'workAddress', 'workWebsite',
  'escoUri', 'escoLabel', 'iscoCode', 'escoSkills',
  // Company-only structure
  'companyName', 'tradeName', 'companyVatNumber',
  'shareholders', 'branches', 'companyAddresses',
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
