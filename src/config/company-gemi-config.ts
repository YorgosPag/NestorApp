/**
 * 🏢 COMPANY GEMI FIELDS CONFIGURATION
 *
 * Single Source of Truth για όλα τα πεδία ΓΕΜΗ εταιρειών
 * Χρησιμοποιείται από:
 * - CompanyContactSection.tsx (Form creation/editing)
 * - ContactDetails.tsx (Display tabs)
 * - Future generic form/display components
 *
 * @version 1.0.0
 * @created 2025-11-28
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type FieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'email' | 'tel';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  /** Unique field identifier (matches ContactFormData property) */
  id: string;
  /** Display label */
  label: string;
  /** Field type */
  type: FieldType;
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
}

export interface SectionConfig {
  /** Section unique identifier */
  id: string;
  /** Section display title */
  title: string;
  /** Section emoji icon */
  icon: string;
  /** Section description */
  description?: string;
  /** Fields in this section */
  fields: FieldConfig[];
  /** Section order priority */
  order: number;
}

// ============================================================================
// FIELD OPTIONS CONFIGURATIONS
// ============================================================================

/** Νομικές μορφές εταιρειών */
export const LEGAL_FORM_OPTIONS: SelectOption[] = [
  { value: 'OE', label: 'Ο.Ε. (Ομόρρυθμη Εταιρεία)' },
  { value: 'EE', label: 'Ε.Ε. (Ετερόρρυθμη Εταιρεία)' },
  { value: 'EPE', label: 'Ε.Π.Ε. (Εταιρεία Περιορισμένης Ευθύνης)' },
  { value: 'AE', label: 'Α.Ε. (Ανώνυμη Εταιρεία)' },
  { value: 'IKE', label: 'Ι.Κ.Ε. (Ιδιωτική Κεφαλαιουχική Εταιρεία)' },
  { value: 'MONO', label: 'Μονοπρόσωπη Ι.Κ.Ε.' },
];

/** Κατάσταση ΓΕΜΗ */
export const GEMI_STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Ενεργή' },
  { value: 'inactive', label: 'Ανενεργή' },
  { value: 'dissolved', label: 'Λυθείσα' },
  { value: 'bankruptcy', label: 'Σε Πτώχευση' },
];

/** Τύπος δραστηριότητας */
export const ACTIVITY_TYPE_OPTIONS: SelectOption[] = [
  { value: 'main', label: 'Κύρια' },
  { value: 'secondary', label: 'Δευτερεύουσα' },
];

/** Νόμισμα */
export const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'EUR', label: 'EUR (Ευρώ)' },
  { value: 'USD', label: 'USD (Δολάρια ΗΠΑ)' },
  { value: 'GBP', label: 'GBP (Λίρες Στερλίνες)' },
];

// ============================================================================
// COMPANY GEMI SECTIONS CONFIGURATION
// ============================================================================

export const COMPANY_GEMI_SECTIONS: SectionConfig[] = [
  // -------------------------------------------------------------------------
  // 1. ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ ΓΕΜΗ
  // -------------------------------------------------------------------------
  {
    id: 'basicInfo',
    title: 'Βασικά Στοιχεία ΓΕΜΗ',
    icon: '🏢',
    description: 'Βασικές πληροφορίες εταιρείας από το ΓΕΜΗ',
    order: 1,
    fields: [
      {
        id: 'companyName',
        label: 'Επωνυμία Εταιρείας',
        type: 'input',
        required: true,
        helpText: 'Πλήρης επωνυμία όπως είναι καταχωρημένη στο ΓΕΜΗ',
      },
      {
        id: 'tradeName',
        label: 'Διακριτικός Τίτλος',
        type: 'input',
        helpText: 'Εμπορική επωνυμία (αν διαφέρει από την επίσημη)',
      },
      {
        id: 'companyVatNumber',
        label: 'ΑΦΜ',
        type: 'input',
        required: true,
        maxLength: 9,
        placeholder: '999999999',
        helpText: 'Αριθμός Φορολογικού Μητρώου (9 ψηφία)',
      },
      {
        id: 'gemiNumber',
        label: 'Αριθμός ΓΕΜΗ',
        type: 'input',
        helpText: 'Μοναδικός αριθμός εγγραφής στο ΓΕΜΗ',
      },
      {
        id: 'legalForm',
        label: 'Νομική Μορφή',
        type: 'select',
        options: LEGAL_FORM_OPTIONS,
        helpText: 'Νομική μορφή εταιρείας',
      },
      {
        id: 'gemiStatus',
        label: 'Κατάσταση ΓΕΜΗ',
        type: 'select',
        options: GEMI_STATUS_OPTIONS,
        defaultValue: 'active',
        helpText: 'Τρέχουσα κατάσταση εταιρείας στο ΓΕΜΗ',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. ΔΡΑΣΤΗΡΙΟΤΗΤΕΣ & ΚΑΔ
  // -------------------------------------------------------------------------
  {
    id: 'activities',
    title: 'Δραστηριότητες & ΚΑΔ',
    icon: '📋',
    description: 'Κωδικοί και περιγραφές επιχειρηματικής δραστηριότητας',
    order: 2,
    fields: [
      {
        id: 'activityCodeKAD',
        label: 'Κωδικός ΚΑΔ',
        type: 'input',
        placeholder: 'π.χ. 47.11.10',
        helpText: 'Κωδικός Αριθμός Δραστηριότητας',
      },
      {
        id: 'activityDescription',
        label: 'Περιγραφή Δραστηριότητας',
        type: 'input',
        helpText: 'Αναλυτική περιγραφή της επιχειρηματικής δραστηριότητας',
      },
      {
        id: 'activityType',
        label: 'Τύπος Δραστηριότητας',
        type: 'select',
        options: ACTIVITY_TYPE_OPTIONS,
        defaultValue: 'main',
        helpText: 'Κατηγοριοποίηση δραστηριότητας',
      },
      {
        id: 'chamber',
        label: 'Επιμελητήριο',
        type: 'input',
        helpText: 'Επιμελητήριο ή τοπική υπηρεσία ΓΕΜΗ',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. ΚΕΦΑΛΑΙΟ & ΟΙΚΟΝΟΜΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'capital',
    title: 'Κεφάλαιο & Οικονομικά',
    icon: '💰',
    description: 'Κεφάλαιο και οικονομικά στοιχεία εταιρείας',
    order: 3,
    fields: [
      {
        id: 'capitalAmount',
        label: 'Κεφάλαιο',
        type: 'number',
        placeholder: 'π.χ. 50000',
        helpText: 'Εταιρικό κεφάλαιο σε αριθμητική μορφή',
      },
      {
        id: 'currency',
        label: 'Νόμισμα',
        type: 'select',
        options: CURRENCY_OPTIONS,
        defaultValue: 'EUR',
        helpText: 'Νόμισμα κεφαλαίου',
      },
      {
        id: 'extraordinaryCapital',
        label: 'Εξωλογιστικά Κεφάλαια',
        type: 'number',
        helpText: 'Εγγυητικά ή εξωλογιστικά κεφάλαια',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. ΗΜΕΡΟΜΗΝΙΕΣ & ΤΟΠΟΘΕΣΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'datesLocation',
    title: 'Ημερομηνίες & Τοποθεσία',
    icon: '📅',
    description: 'Χρονολογικά και γεωγραφικά στοιχεία',
    order: 4,
    fields: [
      {
        id: 'registrationDate',
        label: 'Ημερομηνία Εγγραφής',
        type: 'date',
        helpText: 'Ημερομηνία πρώτης εγγραφής στο ΓΕΜΗ',
      },
      {
        id: 'gemiStatusDate',
        label: 'Ημερομηνία Κατάστασης',
        type: 'date',
        helpText: 'Ημερομηνία τελευταίας αλλαγής κατάστασης',
      },
      {
        id: 'prefecture',
        label: 'Νομός',
        type: 'input',
        helpText: 'Νομός έδρας εταιρείας',
      },
      {
        id: 'municipality',
        label: 'Δήμος',
        type: 'input',
        helpText: 'Δήμος έδρας εταιρείας',
      },
      {
        id: 'gemiDepartment',
        label: 'Τοπική Υπηρεσία ΓΕΜΗ',
        type: 'input',
        helpText: 'Αρμόδια τοπική υπηρεσία ΓΕΜΗ',
      },
    ],
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Αποκτά όλα τα πεδία από όλες τις ενότητες
 */
export function getAllCompanyFields(): FieldConfig[] {
  return COMPANY_GEMI_SECTIONS.flatMap(section => section.fields);
}

/**
 * Αποκτά μια συγκεκριμένη ενότητα πεδίων
 */
export function getCompanySection(sectionId: string): SectionConfig | undefined {
  return COMPANY_GEMI_SECTIONS.find(section => section.id === sectionId);
}

/**
 * Αποκτά ένα συγκεκριμένο πεδίο από όλες τις ενότητες
 */
export function getCompanyField(fieldId: string): FieldConfig | undefined {
  return getAllCompanyFields().find(field => field.id === fieldId);
}

/**
 * Δημιουργεί mapping από field ID σε FieldConfig για γρήγορη αναζήτηση
 */
export function createFieldsMap(): Map<string, FieldConfig> {
  const map = new Map<string, FieldConfig>();
  getAllCompanyFields().forEach(field => {
    map.set(field.id, field);
  });
  return map;
}

/**
 * Ελέγχει αν ένα πεδίο είναι required
 */
export function isFieldRequired(fieldId: string): boolean {
  const field = getCompanyField(fieldId);
  return field?.required ?? false;
}

/**
 * Αποκτά τις ενότητες ταξινομημένες κατά σειρά priority
 */
export function getSortedSections(): SectionConfig[] {
  return [...COMPANY_GEMI_SECTIONS].sort((a, b) => a.order - b.order);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sections: COMPANY_GEMI_SECTIONS,
  getAllFields: getAllCompanyFields,
  getSection: getCompanySection,
  getField: getCompanyField,
  createFieldsMap,
  isFieldRequired,
  getSortedSections,
};