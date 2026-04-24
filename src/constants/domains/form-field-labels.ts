/**
 * FORM FIELD LABELS
 *
 * Form field labels for individual contacts, companies, and services.
 * Used by config files (individual-config, company-config, service-config).
 *
 * @domain Contact/Entity Form Configuration
 * @consumers individual-config.ts, company-config.ts, service-config.ts, CommunicationConfigs.ts
 */

// ============================================================================
// IDENTITY & CLASSIFICATION TYPE LABELS
// ============================================================================

export const IDENTITY_TYPE_LABELS = {
  id_card: 'contacts.identity.types.idCard',
  identity_card: 'contacts.identity.types.identityCard',
  passport: 'contacts.identity.types.passport',
  afm: 'contacts.identity.types.afm',
  amka: 'contacts.identity.types.amka',
  license: 'contacts.identity.types.license',
  drivers_license: 'contacts.identity.types.driversLicense',
  other: 'contacts.identity.types.other'
} as const;

export const PROFESSIONAL_TYPE_LABELS = {
  company_phone: 'contacts.professional.types.companyPhone',
  company_email: 'contacts.professional.types.companyEmail',
  company_website: 'contacts.professional.types.companyWebsite',
  linkedin: 'contacts.professional.types.linkedin',
  position: 'contacts.professional.types.position',
  department: 'contacts.professional.types.department',
  other: 'contacts.professional.types.other'
} as const;

export const ADDRESS_TYPE_LABELS = {
  home: 'contacts.address.types.home',
  work: 'contacts.address.types.work',
  mailing: 'contacts.address.types.mailing',
  billing: 'contacts.address.types.billing',
  headquarters: 'contacts.address.types.headquarters',
  branch: 'contacts.address.types.branch',
  other: 'contacts.address.types.other'
} as const;

// ============================================================================
// INDIVIDUAL FORM FIELD LABELS
// ============================================================================

export const PERSONAL_INFO_FIELD_LABELS = {
  FIRST_NAME: 'individual.fields.firstName',
  LAST_NAME: 'individual.fields.lastName',
  FATHER_NAME: 'individual.fields.fatherName',
  MOTHER_NAME: 'individual.fields.motherName',
  BIRTH_DATE: 'individual.fields.birthDate',
  BIRTH_COUNTRY: 'individual.fields.birthCountry',
  GENDER: 'individual.fields.gender'
} as const;

export const IDENTITY_DOCUMENT_FIELD_LABELS = {
  AMKA: 'individual.fields.amka',
  DOCUMENT_TYPE: 'individual.fields.documentType',
  DOCUMENT_ISSUER: 'individual.fields.documentIssuer',
  DOCUMENT_NUMBER: 'individual.fields.documentNumber',
  DOCUMENT_ISSUE_DATE: 'individual.fields.documentIssueDate',
  DOCUMENT_EXPIRY_DATE: 'individual.fields.documentExpiryDate'
} as const;

export const TAX_INFO_FIELD_LABELS = {
  VAT_NUMBER: 'individual.fields.vatNumber',
  TAX_OFFICE: 'individual.fields.taxOffice'
} as const;

export const PROFESSIONAL_INFO_FIELD_LABELS = {
  PROFESSION: 'individual.fields.profession',
  SPECIALTY: 'individual.fields.specialty',
  EMPLOYER: 'individual.fields.employer',
  POSITION: 'individual.fields.position',
  ESCO_URI: 'esco.escoLabel',
  ISCO_CODE: 'esco.iscoCode',
  SKILLS: 'individual.fields.skills'
} as const;

export const ADDRESS_INFO_FIELD_LABELS = {
  STREET: 'address.fields.street',
  STREET_NUMBER: 'address.fields.streetNumber',
  CITY: 'address.fields.city',
  POSTAL_CODE: 'address.fields.postalCode'
} as const;

export const CONTACT_INFO_FIELD_LABELS = {
  COMMUNICATION: 'fields.communication'
} as const;

