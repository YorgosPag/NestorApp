// ============================================================================
// SERVICE CONFIGURATION - TABS FOR ΔΗΜΟΣΙΕΣ ΥΠΗΡΕΣΙΕΣ
// ============================================================================

// 🏢 ENTERPRISE: Use centralized options from modal-select system
import {
  getServiceFieldLabels,
  getServiceCategoryOptions,
} from '../subapps/dxf-viewer/config/modal-select';

// 🏢 ENTERPRISE: Import centralized service form field labels - ZERO HARDCODED VALUES
import {
  ADDRESS_INFO_FIELD_LABELS
} from '../constants/property-statuses-enterprise';
//
// Κεντρικοποιημένη διαμόρφωση για δημόσιες υπηρεσίες με tab layout
// Αντικαθιστά τα ΓΕΜΙ fields που δεν ισχύουν για δημόσιους φορείς
//
// ============================================================================

export interface ServiceFieldConfig {
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

export interface ServiceSectionConfig {
  id: string;
  title: string;
  icon: string; // Lucide icon name
  fields: ServiceFieldConfig[];
}

// ============================================================================
// ΔΗΜΟΣΙΕΣ ΥΠΗΡΕΣΙΕΣ - SECTION CONFIGURATIONS
// ============================================================================

// Get field labels once at module level
const serviceFieldLabels = getServiceFieldLabels();

/**
 * Βασικά Στοιχεία Δημόσιας Υπηρεσίας
 * ✅ ENTERPRISE: Using centralized service field labels
 * 🌐 i18n: All placeholders and helpTexts converted to i18n keys - 2026-01-19
 */
const basicInfoSection: ServiceSectionConfig = (() => {
  const fieldLabels = serviceFieldLabels;
  return {
    id: 'basicInfo',
    title: 'contacts.service.sections.basicInfo.title',
    icon: 'landmark',
  fields: [
    {
      id: 'name',
      type: 'input',
      label: fieldLabels.service_name,
      placeholder: 'contacts.service.fields.name.placeholder',
      required: true,
      helpText: 'contacts.service.fields.name.helpText'
    },
    {
      id: 'shortName',
      type: 'input',
      label: fieldLabels.short_name,
      placeholder: 'contacts.service.fields.shortName.placeholder',
      helpText: 'contacts.service.fields.shortName.helpText'
    },
    {
      id: 'category',
      type: 'select',
      label: fieldLabels.category,
      required: true,
      options: [
        // ✅ ENTERPRISE: Using centralized service category options - NO MORE HARDCODED VALUES
        ...getServiceCategoryOptions()
      ]
    },
    {
      id: 'supervisionMinistry',
      type: 'input',
      label: fieldLabels.supervision_ministry,
      placeholder: 'contacts.service.fields.supervisionMinistry.placeholder',
      helpText: 'contacts.service.fields.supervisionMinistry.helpText'
    }
  ]
  };
})();

/**
 * Διεύθυνση Υπηρεσίας
 * Ξεχωριστό tab — ομοιόμορφο με individual/company address tabs
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const addressSection: ServiceSectionConfig = {
  id: 'address',
  title: 'contacts.service.sections.address.title',
  icon: 'map-pin',
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
      helpText: 'contacts.common.fields.city.helpText'
    },
    {
      id: 'postalCode',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.POSTAL_CODE,
      placeholder: '12345',
      maxLength: 5,
      required: true,
      helpText: 'contacts.common.fields.postalCode.helpText'
    }
  ]
};

/**
 * Επικοινωνία (Dynamic arrays — phones, emails, websites, social media)
 * Ξεχωριστό tab — ομοιόμορφο με individual/company communication tabs
 * Custom renderer: DynamicContactArrays μέσω UnifiedContactTabbedSection
 */
const communicationSection: ServiceSectionConfig = {
  id: 'communication',
  title: 'contacts.service.sections.communication.title',
  icon: 'smartphone',
  fields: [
    {
      id: 'communication',
      type: 'input',
      label: 'contacts.fields.communication'
      // Dummy field — triggers DynamicContactArrays custom renderer
    }
  ]
};

/**
 * Λογότυπο & Επικοινωνία
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const logoSection: ServiceSectionConfig = {
  id: 'logo',
  title: 'contacts.service.sections.logo.title',
  icon: 'image',
  fields: [
    // Removed description field - λογότυπο θα renderάρεται χωρίς επιπλέον fields
  ]
};

// ============================================================================
// ΚΕΝΤΡΙΚΗ ΣΥΛΛΟΓΗ SECTIONS
// ============================================================================

/**
 * Όλα τα sections για δημόσιες υπηρεσίες
 */
// -------------------------------------------------------------------------
// 6. ΣΧΕΣΕΙΣ - 🏢 ENTERPRISE RELATIONSHIP MANAGEMENT
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// -------------------------------------------------------------------------
const relationshipsSection: ServiceSectionConfig = {
  id: 'relationships',
  title: 'contacts.service.sections.relationships.title',
  icon: 'users',
  fields: [
    // Fields are handled by ContactRelationshipManager component
    // No individual fields needed as this is a complex UI component
  ]
};

// -------------------------------------------------------------------------
// 7. ΕΓΓΡΑΦΑ ΕΠΑΦΗΣ - 🏢 ENTERPRISE FILE MANAGEMENT (ADR-031)
// -------------------------------------------------------------------------
const filesSection: ServiceSectionConfig = {
  id: 'files',
  title: 'contacts.service.sections.files.title',
  icon: 'file-text',
  fields: [
    // 🎯 DUMMY FIELD για custom renderer triggering
    // Fields are handled by EntityFilesManager component
    {
      id: 'files',
      type: 'input',
      label: 'contacts.service.sections.files.title'
      // Dummy field - actual UI rendered by EntityFilesManager
    }
  ]
};

// -------------------------------------------------------------------------
// 8. ΤΡΑΠΕΖΙΚΑ - 🏢 ENTERPRISE BANKING SYSTEM (ADR-126)
// -------------------------------------------------------------------------
const bankingSection: ServiceSectionConfig = {
  id: 'banking',
  title: 'contacts.service.sections.banking.title',
  icon: 'credit-card',
  fields: [
    // 🎯 DUMMY FIELD για custom renderer triggering
    // Fields are handled by ContactBankingTab component
  ]
};

// -------------------------------------------------------------------------
// 9. ΙΣΤΟΡΙΚΟ - 🏢 ENTERPRISE AUDIT TRAIL (ADR-195)
// SSoT: shares ContactHistoryTab + entity_audit_trail collection with individual/company
// -------------------------------------------------------------------------
const historySection: ServiceSectionConfig = {
  id: 'history',
  title: 'sections.history',
  icon: 'clock',
  fields: [
    {
      id: 'history',
      type: 'input',
      label: 'sections.history'
    }
  ]
};

export const SERVICE_SECTIONS: ServiceSectionConfig[] = [
  basicInfoSection,
  addressSection,
  communicationSection,
  logoSection,
  relationshipsSection,
  filesSection,
  bankingSection,
  historySection
];

/**
 * Επιστρέφει όλα τα sections σε σωστή σειρά για tabs
 */
export function getServiceSortedSections(): ServiceSectionConfig[] {
  return SERVICE_SECTIONS;
}

/**
 * Επιστρέφει συγκεκριμένο section με βάση το ID
 */
export function getServiceSectionById(sectionId: string): ServiceSectionConfig | undefined {
  return SERVICE_SECTIONS.find(section => section.id === sectionId);
}

/**
 * Επιστρέφει όλα τα fields από όλα τα sections (για validation)
 */
export function getAllServiceFields(): ServiceFieldConfig[] {
  return SERVICE_SECTIONS.flatMap(section => section.fields);
}

export default SERVICE_SECTIONS;