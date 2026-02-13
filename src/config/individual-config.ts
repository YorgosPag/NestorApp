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
    title: 'individual.sections.basicInfo.title',
    icon: 'user',
    description: 'individual.sections.basicInfo.description',
    order: 1,
    fields: [
      {
        id: 'firstName',
        label: PERSONAL_INFO_FIELD_LABELS.FIRST_NAME,
        type: 'input',
        required: true,
        helpText: 'individual.helpTexts.firstName',
        icon: 'user',
      },
      {
        id: 'lastName',
        label: PERSONAL_INFO_FIELD_LABELS.LAST_NAME,
        type: 'input',
        required: true,
        helpText: 'individual.helpTexts.lastName',
        icon: 'user',
      },
      {
        id: 'fatherName',
        label: PERSONAL_INFO_FIELD_LABELS.FATHER_NAME,
        type: 'input',
        helpText: 'individual.helpTexts.fatherName',
        icon: 'user-check',
      },
      {
        id: 'motherName',
        label: PERSONAL_INFO_FIELD_LABELS.MOTHER_NAME,
        type: 'input',
        helpText: 'individual.helpTexts.motherName',
        icon: 'user-check',
      },
      {
        id: 'birthDate',
        label: PERSONAL_INFO_FIELD_LABELS.BIRTH_DATE,
        type: 'date',
        helpText: 'individual.helpTexts.birthDate',
        icon: 'cake',
      },
      {
        id: 'birthCountry',
        label: PERSONAL_INFO_FIELD_LABELS.BIRTH_COUNTRY,
        type: 'select',
        options: BIRTH_COUNTRY_OPTIONS,
        helpText: 'individual.helpTexts.birthCountry',
        icon: 'globe',
      },
      {
        id: 'gender',
        label: PERSONAL_INFO_FIELD_LABELS.GENDER,
        type: 'select',
        options: GENDER_OPTIONS,
        helpText: 'individual.helpTexts.gender',
        icon: '⚧️',
      },
      {
        id: 'amka',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.AMKA,
        type: 'input',
        maxLength: 11,
        placeholder: '12345678901',
        helpText: 'individual.helpTexts.amka',
        icon: 'badge',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. ΤΑΥΤΟΤΗΤΑ & ΑΦΜ
  // -------------------------------------------------------------------------
  {
    id: 'identity',
    title: 'individual.sections.identity.title',
    icon: 'credit-card',
    description: 'individual.sections.identity.description',
    order: 2,
    fields: [
      {
        id: 'documentType',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_TYPE,
        type: 'select',
        options: DOCUMENT_TYPE_OPTIONS,
        helpText: 'individual.helpTexts.documentType',
        icon: 'clipboard',
      },
      {
        id: 'documentIssuer',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_ISSUER,
        type: 'input',
        placeholder: 'individual.placeholders.documentIssuer',
        helpText: 'individual.helpTexts.documentIssuer',
        icon: 'landmark',
      },
      {
        id: 'documentNumber',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_NUMBER,
        type: 'input',
        helpText: 'individual.helpTexts.documentNumber',
        icon: 'hash',
      },
      {
        id: 'documentIssueDate',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_ISSUE_DATE,
        type: 'date',
        helpText: 'individual.helpTexts.documentIssueDate',
        icon: '📅',
      },
      {
        id: 'documentExpiryDate',
        label: IDENTITY_DOCUMENT_FIELD_LABELS.DOCUMENT_EXPIRY_DATE,
        type: 'date',
        helpText: 'individual.helpTexts.documentExpiryDate',
        icon: '⏰',
      },
      {
        id: 'vatNumber',
        label: TAX_INFO_FIELD_LABELS.VAT_NUMBER,
        type: 'input',
        maxLength: 9,
        placeholder: '123456789',
        helpText: 'individual.helpTexts.vatNumber',
        icon: 'dollar-sign',
      },
      {
        id: 'taxOffice',
        label: TAX_INFO_FIELD_LABELS.TAX_OFFICE,
        type: 'input',
        placeholder: 'individual.placeholders.taxOffice',
        helpText: 'individual.helpTexts.taxOffice',
        icon: 'building',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2.5 ΙΔΙΟΤΗΤΕΣ — 🎭 ENTERPRISE: Contact Persona System (ADR-121)
  // -------------------------------------------------------------------------
  {
    id: 'personas',
    title: 'individual.sections.personas.title',
    icon: 'user-cog',
    description: 'individual.sections.personas.description',
    order: 2.5,
    fields: [
      {
        // 🎯 DUMMY FIELD για custom renderer triggering
        // Actual UI rendered by PersonaSelector component
        id: 'personas',
        label: 'individual.fields.personas',
        type: 'input',
      }
    ],
  },

  // -------------------------------------------------------------------------
  // 3. ΕΠΑΓΓΕΛΜΑΤΙΚΑ ΣΤΟΙΧΕΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'professional',
    title: 'individual.sections.professional.title',
    icon: 'briefcase',
    description: 'individual.sections.professional.description',
    order: 3,
    fields: [
      {
        id: 'profession',
        label: PROFESSIONAL_INFO_FIELD_LABELS.PROFESSION,
        type: 'input',
        placeholder: 'individual.placeholders.profession',
        helpText: 'individual.helpTexts.profession',
        icon: 'wrench',
      },
      {
        id: 'specialty',
        label: PROFESSIONAL_INFO_FIELD_LABELS.SPECIALTY,
        type: 'input',
        placeholder: 'individual.placeholders.specialty',
        helpText: 'individual.helpTexts.specialty',
        icon: 'target',
      },
      {
        id: 'employer',
        label: PROFESSIONAL_INFO_FIELD_LABELS.EMPLOYER,
        type: 'input',
        placeholder: 'individual.placeholders.employer',
        helpText: 'individual.helpTexts.employer',
        icon: 'factory',
      },
      {
        id: 'position',
        label: PROFESSIONAL_INFO_FIELD_LABELS.POSITION,
        type: 'input',
        placeholder: 'individual.placeholders.position',
        helpText: 'individual.helpTexts.position',
        icon: 'briefcase',
      },
      {
        // 🎯 DUMMY FIELD για custom renderer triggering (ADR-132)
        // Actual UI rendered by EscoSkillPicker component
        id: 'skills',
        label: PROFESSIONAL_INFO_FIELD_LABELS.SKILLS,
        type: 'input',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. ΔΙΕΥΘΥΝΣΗ ΚΑΤΟΙΚΙΑΣ
  // -------------------------------------------------------------------------
  {
    id: 'address',
    title: 'individual.sections.address.title',
    icon: 'map-pin',
    description: 'individual.sections.address.description',
    order: 4,
    fields: [
      {
        id: 'street',
        label: ADDRESS_INFO_FIELD_LABELS.STREET,
        type: 'input',
        placeholder: 'individual.placeholders.street',
        helpText: 'individual.helpTexts.street',
        icon: 'map-pin',
      },
      {
        id: 'streetNumber',
        label: ADDRESS_INFO_FIELD_LABELS.STREET_NUMBER,
        type: 'input',
        placeholder: 'individual.placeholders.streetNumber',
        helpText: 'individual.helpTexts.streetNumber',
        icon: 'hash',
      },
      {
        id: 'city',
        label: ADDRESS_INFO_FIELD_LABELS.CITY,
        type: 'input',
        placeholder: 'individual.placeholders.city',
        helpText: 'individual.helpTexts.city',
        icon: 'building',
      },
      {
        id: 'postalCode',
        label: ADDRESS_INFO_FIELD_LABELS.POSTAL_CODE,
        type: 'input',
        placeholder: '12345',
        maxLength: 5,
        helpText: 'individual.helpTexts.postalCode',
        icon: 'mail',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. ΕΠΙΚΟΙΝΩΝΙΑ & SOCIAL MEDIA - 🚀 ENTERPRISE DYNAMIC ARRAYS
  // -------------------------------------------------------------------------
  {
    id: 'communication',
    title: 'individual.sections.communication.title',
    icon: 'smartphone',
    description: 'individual.sections.communication.description',
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
    title: 'individual.sections.photo.title',
    icon: 'camera',
    description: 'individual.sections.photo.description',
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
    title: 'individual.sections.relationships.title',
    icon: 'users',
    description: 'individual.sections.relationships.description',
    order: 7,
    fields: [
      // Fields are handled by ContactRelationshipManager component
      // No individual fields needed as this is a complex UI component
    ],
  },

  // -------------------------------------------------------------------------
  // 8. ΑΡΧΕΙΑ - 🏢 ENTERPRISE FILE MANAGEMENT (ADR-031)
  // -------------------------------------------------------------------------
  {
    id: 'files',
    title: 'individual.sections.files.title',
    icon: 'file-text',
    description: 'individual.sections.files.description',
    order: 8,
    fields: [
      // 🎯 DUMMY FIELD για custom renderer triggering
      // Fields are handled by EntityFilesManager component
      {
        id: 'files',
        label: 'contacts.individual.sections.files.title',
        type: 'input'
        // Dummy field - actual UI rendered by EntityFilesManager
      }
    ],
  },

  // -------------------------------------------------------------------------
  // 9. ΤΡΑΠΕΖΙΚΑ - 🏢 ENTERPRISE BANKING SYSTEM (ADR-126)
  // -------------------------------------------------------------------------
  {
    id: 'banking',
    title: 'individual.sections.banking.title',
    icon: 'credit-card',
    description: 'individual.sections.banking.description',
    order: 9,
    fields: [
      // 🎯 DUMMY FIELD για custom renderer triggering
      // Fields are handled by ContactBankingTab component
      {
        id: 'banking',
        label: 'contacts.individual.sections.banking.title',
        type: 'input'
        // Dummy field - actual UI rendered by ContactBankingTab
      }
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