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

export const INDIVIDUAL_SECTIONS: IndividualSectionConfig[] = [
  // -------------------------------------------------------------------------
  // 1. ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'basicInfo',
    title: 'Βασικά Στοιχεία',
    icon: 'user',
    description: 'Βασικές προσωπικές πληροφορίες',
    order: 1,
    fields: [
      {
        id: 'firstName',
        label: 'Όνομα',
        type: 'input',
        required: true,
        helpText: 'Το βαπτιστικό όνομα',
        icon: 'user',
      },
      {
        id: 'lastName',
        label: 'Επώνυμο',
        type: 'input',
        required: true,
        helpText: 'Το οικογενειακό όνομα',
        icon: 'user',
      },
      {
        id: 'fatherName',
        label: 'Πατρώνυμο',
        type: 'input',
        helpText: 'Το όνομα του πατέρα',
        icon: 'user-check',
      },
      {
        id: 'motherName',
        label: 'Μητρώνυμο',
        type: 'input',
        helpText: 'Το όνομα της μητέρας',
        icon: 'user-check',
      },
      {
        id: 'birthDate',
        label: 'Ημερομηνία Γέννησης',
        type: 'date',
        helpText: 'ΗΗ/ΜΜ/ΕΕΕΕ',
        icon: 'cake',
      },
      {
        id: 'birthCountry',
        label: 'Χώρα Γέννησης',
        type: 'select',
        options: BIRTH_COUNTRY_OPTIONS,
        helpText: 'Η χώρα όπου γεννήθηκε',
        icon: 'globe',
      },
      {
        id: 'gender',
        label: 'Φύλο',
        type: 'select',
        options: GENDER_OPTIONS,
        helpText: 'Επιλογή φύλου',
        icon: '⚧️',
      },
      {
        id: 'amka',
        label: 'ΑΜΚΑ',
        type: 'input',
        maxLength: 11,
        placeholder: '12345678901',
        helpText: 'Αριθμός Μητρώου Κοινωνικής Ασφάλισης (11 ψηφία)',
        icon: 'badge',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. ΤΑΥΤΟΤΗΤΑ & ΑΦΜ
  // -------------------------------------------------------------------------
  {
    id: 'identity',
    title: 'Ταυτότητα & ΑΦΜ',
    icon: 'credit-card',
    description: 'Στοιχεία ταυτότητας και φορολογικά στοιχεία',
    order: 2,
    fields: [
      {
        id: 'documentType',
        label: 'Τύπος Εγγράφου',
        type: 'select',
        options: DOCUMENT_TYPE_OPTIONS,
        helpText: 'Επιλέξτε τον τύπο του εγγράφου ταυτότητας',
        icon: 'clipboard',
      },
      {
        id: 'documentIssuer',
        label: 'Εκδούσα Αρχή',
        type: 'input',
        placeholder: 'π.χ. ΑΤ Αθηνών',
        helpText: 'Η αρχή που εξέδωσε το έγγραφο',
        icon: 'landmark',
      },
      {
        id: 'documentNumber',
        label: 'Αριθμός Εγγράφου',
        type: 'input',
        helpText: 'Ο αριθμός του εγγράφου ταυτότητας',
        icon: 'hash',
      },
      {
        id: 'documentIssueDate',
        label: 'Ημερομηνία Έκδοσης',
        type: 'date',
        helpText: 'Πότε εκδόθηκε το έγγραφο',
        icon: '📅',
      },
      {
        id: 'documentExpiryDate',
        label: 'Ημερομηνία Λήξης',
        type: 'date',
        helpText: 'Πότε λήγει το έγγραφο',
        icon: '⏰',
      },
      {
        id: 'vatNumber',
        label: 'ΑΦΜ',
        type: 'input',
        maxLength: 9,
        placeholder: '123456789',
        helpText: 'Αριθμός Φορολογικού Μητρώου (9 ψηφία)',
        icon: 'dollar-sign',
      },
      {
        id: 'taxOffice',
        label: 'ΔΟΥ',
        type: 'input',
        placeholder: 'π.χ. ΔΟΥ Αθηνών',
        helpText: 'Δημόσια Οικονομική Υπηρεσία',
        icon: 'building',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. ΕΠΑΓΓΕΛΜΑΤΙΚΑ ΣΤΟΙΧΕΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'professional',
    title: 'Επαγγελματικά Στοιχεία',
    icon: 'briefcase',
    description: 'Πληροφορίες σχετικά με την εργασία και το επάγγελμα',
    order: 3,
    fields: [
      {
        id: 'profession',
        label: 'Επάγγελμα',
        type: 'input',
        placeholder: 'π.χ. Μηχανικός, Δικηγόρος, Γιατρός',
        helpText: 'Το κύριο επάγγελμα',
        icon: 'wrench',
      },
      {
        id: 'specialty',
        label: 'Ειδικότητα',
        type: 'input',
        placeholder: 'π.χ. Πολιτικός Μηχανικός, Καρδιολόγος',
        helpText: 'Ειδίκευση στον τομέα εργασίας',
        icon: 'target',
      },
      {
        id: 'employer',
        label: 'Επιχείρηση/Εργοδότης',
        type: 'input',
        placeholder: 'π.χ. ΟΤΕ Α.Ε., Δημοτική Επιχείρηση',
        helpText: 'Η επιχείρηση ή οργανισμός εργασίας',
        icon: 'factory',
      },
      {
        id: 'position',
        label: 'Θέση/Ρόλος',
        type: 'input',
        placeholder: 'π.χ. Διευθυντής, Υπάλληλος, Σύμβουλος',
        helpText: 'Η θέση ή ο ρόλος στην εργασία',
        icon: 'briefcase',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. ΔΙΕΥΘΥΝΣΗ ΚΑΤΟΙΚΙΑΣ
  // -------------------------------------------------------------------------
  {
    id: 'address',
    title: 'Διεύθυνση Κατοικίας',
    icon: 'map-pin',
    description: 'Στοιχεία διεύθυνσης κατοικίας',
    order: 4,
    fields: [
      {
        id: 'street',
        label: 'Οδός',
        type: 'input',
        placeholder: 'π.χ. Βασιλίσσης Σοφίας',
        helpText: 'Όνομα οδού χωρίς αριθμό',
        icon: 'map-pin',
      },
      {
        id: 'streetNumber',
        label: 'Αριθμός',
        type: 'input',
        placeholder: 'π.χ. 125',
        helpText: 'Αριθμός οδού (μπορεί να περιλαμβάνει γράμματα π.χ. 25Α)',
        icon: 'hash',
      },
      {
        id: 'city',
        label: 'Πόλη',
        type: 'input',
        placeholder: 'π.χ. Αθήνα, Θεσσαλονίκη',
        helpText: 'Πόλη κατοικίας',
        icon: 'building',
      },
      {
        id: 'postalCode',
        label: 'Τ.Κ.',
        type: 'input',
        placeholder: '12345',
        maxLength: 5,
        helpText: 'Ταχυδρομικός κώδικας (5 ψηφία)',
        icon: 'mail',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. ΕΠΙΚΟΙΝΩΝΙΑ & SOCIAL MEDIA - 🚀 ENTERPRISE DYNAMIC ARRAYS
  // -------------------------------------------------------------------------
  {
    id: 'communication',
    title: 'Επικοινωνία & Social Media',
    icon: 'smartphone',
    description: 'Δυναμική διαχείριση τηλεφώνων, emails, ιστοσελίδων και social media',
    order: 5,
    fields: [
      // 🎯 DUMMY FIELD για custom renderer triggering
      // Αυτό το field δεν εμφανίζεται - χρησιμοποιείται μόνο για να trigger το customRenderers['communication']
      {
        id: 'communication',
        label: 'Επικοινωνία',
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
    title: 'Φωτογραφία',
    icon: 'camera',
    description: 'Upload φωτογραφιών για το προφίλ του ατόμου',
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
    title: 'Σχέσεις',
    icon: 'users',
    description: 'Διαχείριση επαγγελματικών σχέσεων και οργανωτικής ιεραρχίας',
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