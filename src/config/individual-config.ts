/**
 * ============================================================================
 * 👤 INDIVIDUAL CONTACTS CONFIGURATION
 * ============================================================================
 *
 * Single Source of Truth για όλα τα individual contact fields
 * Centralized config που χρησιμοποιείται από:
 * - IndividualContactSection (form rendering)
 * - ContactDetails (tab rendering)
 * - Edit forms (future)
 *
 * Architecture: Config-driven με Generic Components
 * Pattern: Single Source of Truth
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type IndividualFieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'email' | 'tel';

export interface SelectOption {
  value: string;
  label: string;
}

export interface IndividualFieldConfig {
  /** Unique field identifier (matches ContactFormData property) */
  id: string;
  /** Display label */
  label: string;
  /** Field type */
  type: IndividualFieldType;
  /** Required field */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum length for input fields */
  maxLength?: number;
  /** Select options (only for type='select') */
  options?: SelectOption[];
  /** Default value */
  defaultValue?: string;
  /** Help text or description */
  helpText?: string;
  /** CSS class names for styling */
  className?: string;
  /** Icon for display */
  icon?: string;
}

export interface IndividualSectionConfig {
  /** Unique section identifier */
  id: string;
  /** Section display title */
  title: string;
  /** Section icon (emoji) */
  icon: string;
  /** Section description */
  description?: string;
  /** Display order */
  order: number;
  /** Fields in this section */
  fields: IndividualFieldConfig[];
}

// ============================================================================
// SELECT OPTIONS CONSTANTS
// ============================================================================

// 🏢 ENTERPRISE: Use centralized options from modal-select system
import {
  getGenderOptions,
  getIdentityTypeOptions,
  getCountryOptions
} from '@/subapps/dxf-viewer/config/modal-select';

// 🏢 ENTERPRISE: Import centralized form field labels - ZERO HARDCODED VALUES
import {
  PERSONAL_INFO_FIELD_LABELS,
  IDENTITY_DOCUMENT_FIELD_LABELS,
  TAX_INFO_FIELD_LABELS,
  PROFESSIONAL_INFO_FIELD_LABELS,
  ADDRESS_INFO_FIELD_LABELS,
  CONTACT_INFO_FIELD_LABELS
} from '@/constants/property-statuses-enterprise';

/** Φύλο */
export const GENDER_OPTIONS: SelectOption[] =
  // ✅ ENTERPRISE: Using centralized gender options - NO MORE HARDCODED VALUES
  getGenderOptions().map(option => ({
    value: option.value,
    label: option.label
  }));

/** Τύπος εγγράφου ταυτότητας */
export const DOCUMENT_TYPE_OPTIONS: SelectOption[] =
  // ✅ ENTERPRISE: Using centralized identity document type options - NO MORE HARDCODED VALUES
  getIdentityTypeOptions().map(option => ({
    value: option.value,
    label: option.label
  }));

/** Τόπος γέννησης (κύριες χώρες) */
export const BIRTH_COUNTRY_OPTIONS: SelectOption[] =
  // ✅ ENTERPRISE: Using centralized country options - NO MORE HARDCODED VALUES
  getCountryOptions().map(option => ({
    value: option.value,
    label: option.label
  }));

// ============================================================================
// INDIVIDUAL SECTIONS CONFIGURATION
// ============================================================================

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// Labels are translated at runtime by components using useTranslation
export const INDIVIDUAL_SECTIONS: IndividualSectionConfig[] = [
  // -------------------------------------------------------------------------
  // 1. ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'basicInfo',
    title: 'contacts.individual.sections.basicInfo.title',
    icon: 'user',
    description: 'contacts.individual.sections.basicInfo.description',
    order: 1,
    fields: [
      {
        id: 'firstName',
        label: PERSONAL_INFO_FIELD_LABELS.FIRST_NAME,
        type: 'input',
        required: true,
        helpText: 'contacts.individual.fields.firstName.helpText',
        icon: 'user',
      },
      {
        id: 'lastName',
        label: PERSONAL_INFO_FIELD_LABELS.LAST_NAME,
        type: 'input',
        required: true,
        helpText: 'contacts.individual.fields.lastName.helpText',
        icon: 'user',
      },
      {
        id: 'fatherName',
        label: PERSONAL_INFO_FIELD_LABELS.FATHER_NAME,
        type: 'input',
        helpText: 'contacts.individual.fields.fatherName.helpText',
        icon: 'user-check',
      },
      {
        id: 'motherName',
        label: PERSONAL_INFO_FIELD_LABELS.MOTHER_NAME,
        type: 'input',
        helpText: 'contacts.individual.fields.motherName.helpText',
        icon: 'user-check',
      },
      {
        id: 'birthDate',
        label: PERSONAL_INFO_FIELD_LABELS.BIRTH_DATE,
        type: 'date',
        helpText: 'contacts.individual.fields.birthDate.helpText',
        icon: 'cake',
      },
      {
        id: 'birthCountry',
        label: PERSONAL_INFO_FIELD_LABELS.BIRTH_COUNTRY,
        type: 'select',
        options: BIRTH_COUNTRY_OPTIONS,
        helpText: 'contacts.individual.fields.birthCountry.helpText',
        icon: 'globe',
      },
      {
        id: 'gender',
        label: PERSONAL_INFO_FIELD_LABELS.GENDER,
        type: 'select',
        options: GENDER_OPTIONS,
        helpText: 'contacts.individual.fields.gender.helpText',
        icon: '⚧️',
      },
      {
        id: 'amka',
        label: PERSONAL_INFO_FIELD_LABELS.AMKA,
        type: 'input',
        maxLength: 11,
        placeholder: '12345678901',
        helpText: 'contacts.individual.fields.amka.helpText',
        icon: 'badge',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. ΤΑΥΤΟΤΗΤΑ & ΑΦΜ
  // -------------------------------------------------------------------------
  {
    id: 'identity',
    title: 'contacts.individual.sections.identity.title',
    icon: 'credit-card',
    description: 'contacts.individual.sections.identity.description',
    order: 2,
    fields: [
      {
        id: 'documentType',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_TYPE,
        type: 'select',
        options: DOCUMENT_TYPE_OPTIONS,
        helpText: 'contacts.individual.fields.documentType.helpText',
        icon: 'clipboard',
      },
      {
        id: 'documentIssuer',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_ISSUER,
        type: 'input',
        placeholder: 'contacts.individual.fields.documentIssuer.placeholder',
        helpText: 'contacts.individual.fields.documentIssuer.helpText',
        icon: 'landmark',
      },
      {
        id: 'documentNumber',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_NUMBER,
        type: 'input',
        helpText: 'contacts.individual.fields.documentNumber.helpText',
        icon: 'hash',
      },
      {
        id: 'documentIssueDate',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_ISSUE_DATE,
        type: 'date',
        helpText: 'contacts.individual.fields.documentIssueDate.helpText',
        icon: '📅',
      },
      {
        id: 'documentExpiryDate',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_EXPIRY_DATE,
        type: 'date',
        helpText: 'contacts.individual.fields.documentExpiryDate.helpText',
        icon: '⏰',
      },
      {
        id: 'vatNumber',
        label: TAX_INFO_FIELD_LABELS.VAT_NUMBER,
        type: 'input',
        maxLength: 9,
        placeholder: '123456789',
        helpText: 'contacts.individual.fields.vatNumber.helpText',
        icon: 'dollar-sign',
      },
      {
        id: 'taxOffice',
        label: TAX_INFO_FIELD_LABELS.TAX_OFFICE,
        type: 'input',
        placeholder: 'contacts.individual.fields.taxOffice.placeholder',
        helpText: 'contacts.individual.fields.taxOffice.helpText',
        icon: 'building',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. ΕΠΑΓΓΕΛΜΑΤΙΚΑ ΣΤΟΙΧΕΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'professional',
    title: 'contacts.individual.sections.professional.title',
    icon: 'briefcase',
    description: 'contacts.individual.sections.professional.description',
    order: 3,
    fields: [
      {
        id: 'profession',
        label: PROFESSIONAL_INFO_FIELD_LABELS.PROFESSION,
        type: 'input',
        placeholder: 'contacts.individual.fields.profession.placeholder',
        helpText: 'contacts.individual.fields.profession.helpText',
        icon: 'wrench',
      },
      {
        id: 'specialty',
        label: PROFESSIONAL_INFO_FIELD_LABELS.SPECIALTY,
        type: 'input',
        placeholder: 'contacts.individual.fields.specialty.placeholder',
        helpText: 'contacts.individual.fields.specialty.helpText',
        icon: 'target',
      },
      {
        id: 'employer',
        label: PROFESSIONAL_INFO_FIELD_LABELS.EMPLOYER,
        type: 'input',
        placeholder: 'contacts.individual.fields.employer.placeholder',
        helpText: 'contacts.individual.fields.employer.helpText',
        icon: 'factory',
      },
      {
        id: 'position',
        label: PROFESSIONAL_INFO_FIELD_LABELS.POSITION,
        type: 'input',
        placeholder: 'contacts.individual.fields.position.placeholder',
        helpText: 'contacts.individual.fields.position.helpText',
        icon: 'briefcase',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. ΔΙΕΥΘΥΝΣΗ ΚΑΤΟΙΚΙΑΣ
  // -------------------------------------------------------------------------
  {
    id: 'address',
    title: 'contacts.individual.sections.address.title',
    icon: 'map-pin',
    description: 'contacts.individual.sections.address.description',
    order: 4,
    fields: [
      {
        id: 'street',
        label: ADDRESS_INFO_FIELD_LABELS.STREET,
        type: 'input',
        placeholder: 'contacts.common.fields.street.placeholder',
        helpText: 'contacts.common.fields.street.helpText',
        icon: 'map-pin',
      },
      {
        id: 'streetNumber',
        label: ADDRESS_INFO_FIELD_LABELS.STREET_NUMBER,
        type: 'input',
        placeholder: 'contacts.common.fields.streetNumber.placeholder',
        helpText: 'contacts.common.fields.streetNumber.helpText',
        icon: 'hash',
      },
      {
        id: 'city',
        label: ADDRESS_INFO_FIELD_LABELS.CITY,
        type: 'input',
        placeholder: 'contacts.common.fields.city.placeholder',
        helpText: 'contacts.common.fields.city.helpText',
        icon: 'building',
      },
      {
        id: 'postalCode',
        label: ADDRESS_INFO_FIELD_LABELS.POSTAL_CODE,
        type: 'input',
        placeholder: '12345',
        maxLength: 5,
        helpText: 'contacts.common.fields.postalCode.helpText',
        icon: 'mail',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. ΕΠΙΚΟΙΝΩΝΙΑ & SOCIAL MEDIA - 🚀 ENTERPRISE DYNAMIC ARRAYS
  // -------------------------------------------------------------------------
  {
    id: 'communication',
    title: 'contacts.individual.sections.communication.title',
    icon: 'smartphone',
    description: 'contacts.individual.sections.communication.description',
    order: 5,
    fields: [
      // 🎯 DUMMY FIELD για custom renderer triggering
      // Αυτό το field δεν εμφανίζεται - χρησιμοποιείται μόνο για να trigger το customRenderers['communication']
      {
        id: 'communication',
        label: CONTACT_INFO_FIELD_LABELS.COMMUNICATION,
        type: 'input'
        // Δεν βάζουμε helpText για να μην εμφανίζεται στο UI
      }
    ],
  },

  // -------------------------------------------------------------------------
  // 6. ΦΩΤΟΓΡΑΦΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'photo',
    title: 'contacts.individual.sections.photo.title',
    icon: 'camera',
    description: 'contacts.individual.sections.photo.description',
    order: 6,
    fields: [
      // Αφαιρέθηκε το textarea field για σημειώσεις φωτογραφίας
    ],
  },

  // -------------------------------------------------------------------------
  // 7. ΣΧΕΣΕΙΣ - 🏢 ENTERPRISE RELATIONSHIP MANAGEMENT
  // -------------------------------------------------------------------------
  {
    id: 'relationships',
    title: 'contacts.individual.sections.relationships.title',
    icon: 'users',
    description: 'contacts.individual.sections.relationships.description',
    order: 7,
    fields: [
      // Fields are handled by ContactRelationshipManager component
      // No individual fields needed as this is a complex UI component
    ],
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all sections sorted by order
 */
export function getIndividualSortedSections(): IndividualSectionConfig[] {
  return [...INDIVIDUAL_SECTIONS].sort((a, b) => a.order - b.order);
}

/**
 * Get specific section by ID
 */
export function getIndividualSection(sectionId: string): IndividualSectionConfig | undefined {
  return INDIVIDUAL_SECTIONS.find(section => section.id === sectionId);
}

/**
 * Get specific field by section and field ID
 */
export function getIndividualField(sectionId: string, fieldId: string): IndividualFieldConfig | undefined {
  const section = getIndividualSection(sectionId);
  return section?.fields.find(field => field.id === fieldId);
}

/**
 * Get all fields from all sections as a flat array
 */
export function getAllIndividualFields(): IndividualFieldConfig[] {
  return INDIVIDUAL_SECTIONS.flatMap(section => section.fields);
}

/**
 * Get field by ID from any section
 */
export function getIndividualFieldById(fieldId: string): IndividualFieldConfig | undefined {
  return getAllIndividualFields().find(field => field.id === fieldId);
}

/**
 * Get all required field IDs
 */
export function getRequiredIndividualFields(): string[] {
  return getAllIndividualFields()
    .filter(field => field.required)
    .map(field => field.id);
}