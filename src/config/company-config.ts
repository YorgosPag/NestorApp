'use client';

// 🏢 ENTERPRISE: Import centralized company form field labels - ZERO HARDCODED VALUES
import {
  COMPANY_LEGAL_FORM_LABELS,
  COMPANY_BASIC_INFO_LABELS,
  COMPANY_GEMI_INFO_LABELS,
  COMPANY_CONTACT_INFO_LABELS,
  COMPANY_GEMI_STATUS_OPTIONS,
  TAX_INFO_FIELD_LABELS,
  ADDRESS_INFO_FIELD_LABELS
} from '@/constants/property-statuses-enterprise';

// ============================================================================
// COMPANY CONFIGURATION - TABS FOR ΕΤΑΙΡΕΙΕΣ
// ============================================================================
//
// Κεντρικοποιημένη διαμόρφωση για εταιρείες με tab layout
// Αντιστοιχεί στη δομή του service-config.ts για consistency
//
// ============================================================================

export interface CompanyFieldConfig {
  id: string;
  type: 'input' | 'textarea' | 'select' | 'email' | 'tel' | 'number' | 'date' | 'url';
  label: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  className?: string;
  maxLength?: number;
  defaultValue?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface CompanySectionConfig {
  id: string;
  title: string;
  icon: string; // Lucide icon name
  fields: CompanyFieldConfig[];
}

// ============================================================================
// ΕΤΑΙΡΕΙΕΣ - SECTION CONFIGURATIONS
// ============================================================================

/**
 * Βασικά Στοιχεία Εταιρείας
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const basicInfoSection: CompanySectionConfig = {
  id: 'basicInfo',
  title: 'contacts.company.sections.basicInfo.title',
  icon: 'building',
  fields: [
    {
      id: 'companyName',
      type: 'input',
      label: COMPANY_BASIC_INFO_LABELS.COMPANY_NAME,
      placeholder: 'contacts.company.fields.companyName.placeholder',
      required: true,
      helpText: 'contacts.company.fields.companyName.helpText'
    },
    {
      id: 'tradeName',
      type: 'input',
      label: COMPANY_BASIC_INFO_LABELS.TRADE_NAME,
      placeholder: 'contacts.company.fields.tradeName.placeholder',
      helpText: 'contacts.company.fields.tradeName.helpText'
    },
    {
      id: 'legalForm',
      type: 'select',
      label: COMPANY_BASIC_INFO_LABELS.LEGAL_FORM,
      required: true,
      options: [
        { value: 'ae', label: COMPANY_LEGAL_FORM_LABELS.ae },
        { value: 'epe', label: COMPANY_LEGAL_FORM_LABELS.epe },
        { value: 'ee', label: COMPANY_LEGAL_FORM_LABELS.ee },
        { value: 'oe', label: COMPANY_LEGAL_FORM_LABELS.oe },
        { value: 'ikepe', label: COMPANY_LEGAL_FORM_LABELS.ikepe },
        { value: 'smpc', label: COMPANY_LEGAL_FORM_LABELS.smpc },
        { value: 'other', label: COMPANY_LEGAL_FORM_LABELS.other }
      ]
    },
    {
      id: 'vatNumber',
      type: 'input',
      label: TAX_INFO_FIELD_LABELS.VAT_NUMBER,
      placeholder: '123456789',
      maxLength: 9,
      required: true,
      helpText: 'contacts.company.fields.vatNumber.helpText'
    }
  ]
};

/**
 * ΓΕΜΗ Στοιχεία
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const gemiSection: CompanySectionConfig = {
  id: 'gemi',
  title: 'contacts.company.sections.gemi.title',
  icon: 'file-text',
  fields: [
    {
      id: 'gemiNumber',
      type: 'input',
      label: COMPANY_GEMI_INFO_LABELS.GEMI_NUMBER,
      placeholder: '123456789',
      helpText: 'contacts.company.fields.gemiNumber.helpText'
    },
    {
      id: 'gemiStatus',
      type: 'select',
      label: COMPANY_GEMI_INFO_LABELS.GEMI_STATUS,
      options: [
        { value: 'active', label: COMPANY_GEMI_STATUS_OPTIONS.ACTIVE },
        { value: 'inactive', label: COMPANY_GEMI_STATUS_OPTIONS.INACTIVE },
        { value: 'suspended', label: COMPANY_GEMI_STATUS_OPTIONS.SUSPENDED },
        { value: 'dissolution', label: COMPANY_GEMI_STATUS_OPTIONS.DISSOLUTION }
      ]
    },
    {
      id: 'chamber',
      type: 'input',
      label: COMPANY_GEMI_INFO_LABELS.CHAMBER,
      placeholder: 'contacts.company.fields.chamber.placeholder',
      helpText: 'contacts.company.fields.chamber.helpText'
    },
    {
      id: 'activityCodeKAD',
      type: 'input',
      label: COMPANY_GEMI_INFO_LABELS.ACTIVITY_CODE_KAD,
      placeholder: 'contacts.company.fields.activityCodeKAD.placeholder',
      helpText: 'contacts.company.fields.activityCodeKAD.helpText'
    },
    {
      id: 'activityDescription',
      type: 'textarea',
      label: COMPANY_GEMI_INFO_LABELS.ACTIVITY_DESCRIPTION,
      placeholder: 'contacts.company.fields.activityDescription.placeholder',
      helpText: 'contacts.company.fields.activityDescription.helpText'
    }
  ]
};

/**
 * Στοιχεία Επικοινωνίας
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const contactSection: CompanySectionConfig = {
  id: 'contact',
  title: 'contacts.company.sections.contact.title',
  icon: 'phone',
  fields: [
    {
      id: 'street',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.STREET,
      placeholder: 'contacts.common.fields.street.placeholder',
      required: true,
      helpText: 'contacts.common.fields.street.helpText'
    },
    {
      id: 'streetNumber',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.STREET_NUMBER,
      placeholder: 'contacts.common.fields.streetNumber.placeholder',
      required: true,
      helpText: 'contacts.common.fields.streetNumber.helpText'
    },
    {
      id: 'city',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.CITY,
      placeholder: 'contacts.common.fields.city.placeholder',
      required: true,
      helpText: 'contacts.company.fields.city.helpText'
    },
    {
      id: 'postalCode',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.POSTAL_CODE,
      placeholder: '12345',
      maxLength: 5,
      required: true,
      helpText: 'contacts.common.fields.postalCode.helpText'
    },
    {
      id: 'phone',
      type: 'tel',
      label: COMPANY_CONTACT_INFO_LABELS.PHONE_CENTRAL,
      placeholder: '2101234567',
      helpText: 'contacts.company.fields.phone.helpText'
    },
    {
      id: 'email',
      type: 'email',
      label: COMPANY_CONTACT_INFO_LABELS.EMAIL_CONTACT,
      placeholder: 'info@company.gr',
      helpText: 'contacts.company.fields.email.helpText'
    },
    {
      id: 'website',
      type: 'url',
      label: COMPANY_CONTACT_INFO_LABELS.WEBSITE,
      placeholder: 'https://www.company.gr',
      helpText: 'contacts.company.fields.website.helpText'
    }
  ]
};

/**
 * Λογότυπο
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const logoSection: CompanySectionConfig = {
  id: 'logo',
  title: 'contacts.company.sections.logo.title',
  icon: 'image',
  fields: [
    // Λογότυπο θα renderάρεται χωρίς επιπλέον fields
  ]
};

// -------------------------------------------------------------------------
// 6. ΣΧΕΣΕΙΣ - 🏢 ENTERPRISE RELATIONSHIP MANAGEMENT
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// -------------------------------------------------------------------------
const relationshipsSection: CompanySectionConfig = {
  id: 'relationships',
  title: 'contacts.company.sections.relationships.title',
  icon: 'users',
  fields: [
    // Fields are handled by ContactRelationshipManager component
    // No individual fields needed as this is a complex UI component
  ]
};

export const COMPANY_SECTIONS: CompanySectionConfig[] = [
  basicInfoSection,
  gemiSection,
  contactSection,
  logoSection,
  relationshipsSection
];

/**
 * Επιστρέφει όλα τα sections σε σωστή σειρά για tabs
 */
export function getCompanySortedSections(): CompanySectionConfig[] {
  return COMPANY_SECTIONS;
}

/**
 * Επιστρέφει συγκεκριμένο section με βάση το ID
 */
export function getCompanySectionById(sectionId: string): CompanySectionConfig | undefined {
  return COMPANY_SECTIONS.find(section => section.id === sectionId);
}

/**
 * Επιστρέφει όλα τα fields από όλα τα sections (για validation)
 */
export function getAllCompanyFields(): CompanyFieldConfig[] {
  return COMPANY_SECTIONS.flatMap(section => section.fields);
}

export default COMPANY_SECTIONS;