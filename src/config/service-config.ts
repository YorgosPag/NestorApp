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
 */
const administrativeSection: ServiceSectionConfig = {
  id: 'administrative',
  title: 'Διοικητικά Στοιχεία',
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
      placeholder: 'π.χ. Ν. 3852/2010',
      helpText: 'Ο νόμος που ίδρυσε ή διέπει την υπηρεσία'
    },
    {
      id: 'headTitle',
      type: 'input',
      label: SERVICE_ADMINISTRATIVE_INFO_LABELS.HEAD_TITLE,
      placeholder: 'π.χ. Δήμαρχος, Γενικός Διευθυντής',
      helpText: 'Ο τίτλος του υψηλότερου ιεραρχικά υπευθύνου'
    },
    {
      id: 'headName',
      type: 'input',
      label: SERVICE_ADMINISTRATIVE_INFO_LABELS.HEAD_NAME,
      placeholder: 'Πλήρες όνομα',
      helpText: 'Το όνομα του προϊσταμένου της υπηρεσίας'
    }
  ]
};

/**
 * Στοιχεία Επικοινωνίας
 */
const contactSection: ServiceSectionConfig = {
  id: 'contact',
  title: 'Στοιχεία Επικοινωνίας',
  icon: 'phone',
  fields: [
    {
      id: 'street',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.STREET,
      placeholder: 'π.χ. Βασιλίσσης Σοφίας',
      required: true,
      helpText: 'Όνομα οδού χωρίς αριθμό'
    },
    {
      id: 'streetNumber',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.STREET_NUMBER,
      placeholder: 'π.χ. 125',
      required: true,
      helpText: 'Αριθμός οδού (μπορεί να περιλαμβάνει γράμματα π.χ. 25Α)'
    },
    {
      id: 'city',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.CITY,
      placeholder: 'π.χ. Θεσσαλονίκη',
      required: true,
      helpText: 'Πόλη ή δήμος'
    },
    {
      id: 'postalCode',
      type: 'input',
      label: ADDRESS_INFO_FIELD_LABELS.POSTAL_CODE,
      placeholder: '12345',
      maxLength: 5,
      required: true,
      helpText: 'Ταχυδρομικός κώδικας (5 ψηφία)'
    },
    {
      id: 'phone',
      type: 'tel',
      label: COMPANY_CONTACT_INFO_LABELS.PHONE_CENTRAL,
      placeholder: '2101234567',
      helpText: 'Κεντρικό τηλέφωνο της υπηρεσίας'
    },
    {
      id: 'email',
      type: 'email',
      label: COMPANY_CONTACT_INFO_LABELS.EMAIL_CONTACT,
      placeholder: 'info@service.gov.gr',
      helpText: 'Κεντρικό email της υπηρεσίας'
    },
    {
      id: 'website',
      type: 'url',
      label: COMPANY_CONTACT_INFO_LABELS.WEBSITE,
      placeholder: 'https://www.service.gov.gr',
      helpText: 'Επίσημη ιστοσελίδα της υπηρεσίας'
    }
  ]
};

/**
 * Αρμοδιότητες & Υπηρεσίες
 */
const servicesSection: ServiceSectionConfig = {
  id: 'services',
  title: 'Αρμοδιότητες & Υπηρεσίες',
  icon: 'clipboard-list',
  fields: [
    {
      id: 'mainResponsibilities',
      type: 'textarea',
      label: SERVICE_RESPONSIBILITIES_LABELS.MAIN_RESPONSIBILITIES,
      placeholder: 'Περιγράψτε τις κύριες αρμοδιότητες της υπηρεσίας...',
      required: true,
      helpText: 'Οι βασικές αρμοδιότητες και υποχρεώσεις της υπηρεσίας'
    },
    {
      id: 'citizenServices',
      type: 'textarea',
      label: SERVICE_RESPONSIBILITIES_LABELS.CITIZEN_SERVICES,
      placeholder: 'Περιγράψτε τις υπηρεσίες που προσφέρονται στους πολίτες...',
      helpText: 'Συγκεκριμένες υπηρεσίες που μπορούν να λάβουν οι πολίτες'
    },
    {
      id: 'onlineServices',
      type: 'input',
      label: SERVICE_RESPONSIBILITIES_LABELS.ONLINE_SERVICES,
      placeholder: 'https://gov.gr-connect',
      helpText: 'Link για ηλεκτρονικές υπηρεσίες (gov.gr, κλπ)'
    },
    {
      id: 'serviceHours',
      type: 'input',
      label: SERVICE_RESPONSIBILITIES_LABELS.SERVICE_HOURS,
      placeholder: 'π.χ. Δευτέρα-Παρασκευή 08:00-14:00',
      helpText: 'Ώρες εξυπηρέτησης κοινού'
    }
  ]
};

/**
 * Λογότυπο & Επικοινωνία
 */
const logoSection: ServiceSectionConfig = {
  id: 'logo',
  title: 'Λογότυπο',
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
// -------------------------------------------------------------------------
const relationshipsSection: ServiceSectionConfig = {
  id: 'relationships',
  title: 'Υπάλληλοι & Οργάνωση',
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