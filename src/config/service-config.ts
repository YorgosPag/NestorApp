'use client';

// ============================================================================
// SERVICE CONFIGURATION - TABS FOR ΔΗΜΟΣΙΕΣ ΥΠΗΡΕΣΙΕΣ
// ============================================================================

// 🏢 ENTERPRISE: Use centralized options from modal-select system
import {
  getServiceFieldLabels,
  getServiceCategoryOptions,
  getLegalStatusOptions
} from '../subapps/dxf-viewer/config/modal-select';

// 🏢 ENTERPRISE: Import centralized service form field labels - ZERO HARDCODED VALUES
import {
  SERVICE_ADMINISTRATIVE_INFO_LABELS,
  SERVICE_RESPONSIBILITIES_LABELS,
  ADDRESS_INFO_FIELD_LABELS,
  COMPANY_CONTACT_INFO_LABELS
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
 */
const basicInfoSection: ServiceSectionConfig = (() => {
  const fieldLabels = serviceFieldLabels;
  return {
    id: 'basicInfo',
    title: fieldLabels.basic_info_section,
    icon: 'landmark',
  fields: [
    {
      id: 'name',
      type: 'input',
      label: fieldLabels.service_name,
      placeholder: 'π.χ. Δήμος Αθηναίων',
      required: true,
      helpText: 'Η επίσημη επωνυμία του δημόσιου φορέα'
    },
    {
      id: 'shortName',
      type: 'input',
      label: fieldLabels.short_name,
      placeholder: 'π.χ. Δ.Α.',
      helpText: 'Συντομογραφία ή ακρωνύμιο της υπηρεσίας'
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
      placeholder: 'π.χ. Υπουργείο Εσωτερικών',
      helpText: 'Το υπουργείο που εποπτεύει την υπηρεσία'
    }
  ]
  };
})();

/**
 * Διοικητικά Στοιχεία
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const administrativeSection: ServiceSectionConfig = {
  id: 'administrative',
  title: 'contacts.service.sections.administrative.title',
  icon: 'shield',
  fields: [
    {
      id: 'legalStatus',
      type: 'select',
      label: SERVICE_ADMINISTRATIVE_INFO_LABELS.LEGAL_STATUS,
      required: true,
      options: [
        // ✅ ENTERPRISE: Using centralized legal status options - NO MORE HARDCODED VALUES
        ...getLegalStatusOptions()
      ]
    },
    {
      id: 'establishmentLaw',
      type: 'input',
      label: SERVICE_ADMINISTRATIVE_INFO_LABELS.ESTABLISHMENT_LAW,
      placeholder: 'contacts.service.fields.establishmentLaw.placeholder',
      helpText: 'contacts.service.fields.establishmentLaw.helpText'
    },
    {
      id: 'headTitle',
      type: 'input',
      label: SERVICE_ADMINISTRATIVE_INFO_LABELS.HEAD_TITLE,
      placeholder: 'contacts.service.fields.headTitle.placeholder',
      helpText: 'contacts.service.fields.headTitle.helpText'
    },
    {
      id: 'headName',
      type: 'input',
      label: SERVICE_ADMINISTRATIVE_INFO_LABELS.HEAD_NAME,
      placeholder: 'contacts.service.fields.headName.placeholder',
      helpText: 'contacts.service.fields.headName.helpText'
    }
  ]
};

/**
 * Στοιχεία Επικοινωνίας
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const contactSection: ServiceSectionConfig = {
  id: 'contact',
  title: 'contacts.service.sections.contact.title',
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
    },
    {
      id: 'phone',
      type: 'tel',
      label: COMPANY_CONTACT_INFO_LABELS.PHONE_CENTRAL,
      placeholder: '2101234567',
      helpText: 'contacts.service.fields.phone.helpText'
    },
    {
      id: 'email',
      type: 'email',
      label: COMPANY_CONTACT_INFO_LABELS.EMAIL_CONTACT,
      placeholder: 'info@service.gov.gr',
      helpText: 'contacts.service.fields.email.helpText'
    },
    {
      id: 'website',
      type: 'url',
      label: COMPANY_CONTACT_INFO_LABELS.WEBSITE,
      placeholder: 'https://www.service.gov.gr',
      helpText: 'contacts.service.fields.website.helpText'
    }
  ]
};

/**
 * Αρμοδιότητες & Υπηρεσίες
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
const servicesSection: ServiceSectionConfig = {
  id: 'services',
  title: 'contacts.service.sections.services.title',
  icon: 'clipboard-list',
  fields: [
    {
      id: 'mainResponsibilities',
      type: 'textarea',
      label: SERVICE_RESPONSIBILITIES_LABELS.MAIN_RESPONSIBILITIES,
      placeholder: 'contacts.service.fields.mainResponsibilities.placeholder',
      required: true,
      helpText: 'contacts.service.fields.mainResponsibilities.helpText'
    },
    {
      id: 'citizenServices',
      type: 'textarea',
      label: SERVICE_RESPONSIBILITIES_LABELS.CITIZEN_SERVICES,
      placeholder: 'contacts.service.fields.citizenServices.placeholder',
      helpText: 'contacts.service.fields.citizenServices.helpText'
    },
    {
      id: 'onlineServices',
      type: 'input',
      label: SERVICE_RESPONSIBILITIES_LABELS.ONLINE_SERVICES,
      placeholder: 'https://gov.gr-connect',
      helpText: 'contacts.service.fields.onlineServices.helpText'
    },
    {
      id: 'serviceHours',
      type: 'input',
      label: SERVICE_RESPONSIBILITIES_LABELS.SERVICE_HOURS,
      placeholder: 'contacts.service.fields.serviceHours.placeholder',
      helpText: 'contacts.service.fields.serviceHours.helpText'
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

export const SERVICE_SECTIONS: ServiceSectionConfig[] = [
  basicInfoSection,
  administrativeSection,
  contactSection,
  servicesSection,
  logoSection,
  relationshipsSection
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