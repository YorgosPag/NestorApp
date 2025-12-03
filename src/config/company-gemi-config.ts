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
    icon: 'info',
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
    icon: 'file-text',
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
    icon: 'dollar-sign',
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
    icon: 'calendar',
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

  // -------------------------------------------------------------------------
  // 5. ΔΙΕΥΘΥΝΣΕΙΣ & ΥΠΟΚΑΤΑΣΤΗΜΑΤΑ
  // -------------------------------------------------------------------------
  {
    id: 'addresses',
    title: 'Διευθύνσεις & Υποκαταστήματα',
    icon: 'map-pin',
    description: 'Έδρα και υποκαταστήματα εταιρείας',
    order: 5,
    fields: [
      {
        id: 'addressType',
        label: 'Τύπος Διεύθυνσης',
        type: 'select',
        options: [
          { value: 'headquarters', label: 'Έδρα' },
          { value: 'branch', label: 'Υποκατάστημα' }
        ],
        helpText: 'Είδος διεύθυνσης (έδρα ή υποκατάστημα)',
      },
      {
        id: 'street',
        label: 'Οδός',
        type: 'input',
        helpText: 'Όνομα οδού',
      },
      {
        id: 'streetNumber',
        label: 'Αριθμός',
        type: 'input',
        helpText: 'Αριθμός οδού',
      },
      {
        id: 'postalCode',
        label: 'Ταχυδρομικός Κώδικας',
        type: 'input',
        maxLength: 5,
        helpText: 'Πενταψήφιος ταχυδρομικός κώδικας',
      },
      {
        id: 'city',
        label: 'Πόλη',
        type: 'input',
        helpText: 'Πόλη διεύθυνσης',
      },
      {
        id: 'region',
        label: 'Περιφέρεια',
        type: 'input',
        helpText: 'Περιφέρεια Ελλάδας',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 6. ΜΕΤΟΧΙΚΗ ΣΥΝΘΕΣΗ & ΕΤΑΙΡΟΙ
  // -------------------------------------------------------------------------
  {
    id: 'shareholders',
    title: 'Μετοχική Σύνθεση & Εταίροι',
    icon: 'users',
    description: 'Μέτοχοι και εταιρική σύνθεση',
    order: 6,
    fields: [
      {
        id: 'shareholderName',
        label: 'Όνομα Μετόχου',
        type: 'input',
        helpText: 'Πλήρες όνομα μετόχου ή εταίρου',
      },
      {
        id: 'shareholderType',
        label: 'Τύπος Μετόχου',
        type: 'select',
        options: [
          { value: 'individual', label: 'Φυσικό Πρόσωπο' },
          { value: 'legal', label: 'Νομικό Πρόσωπο' }
        ],
        helpText: 'Τύπος μετόχου (φυσικό ή νομικό πρόσωπο)',
      },
      {
        id: 'shareholderIdNumber',
        label: 'ΑΦΜ/ΑΔΤ Μετόχου',
        type: 'input',
        helpText: 'Αριθμός ταυτότητας ή ΑΦΜ μετόχου',
      },
      {
        id: 'shareType',
        label: 'Είδος Μετοχών',
        type: 'input',
        helpText: 'Κατηγορία μετοχών (κοινές, προνομιούχες κλπ)',
      },
      {
        id: 'sharePercentage',
        label: 'Ποσοστό Συμμετοχής (%)',
        type: 'number',
        helpText: 'Ποσοστό συμμετοχής στο κεφάλαιο',
      },
      {
        id: 'nominalValue',
        label: 'Ονομαστική Αξία',
        type: 'number',
        helpText: 'Ονομαστική αξία μετοχών',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 7. ΕΓΓΡΑΦΑ & ΠΙΣΤΟΠΟΙΗΤΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'documents',
    title: 'Έγγραφα & Πιστοποιητικά',
    icon: 'file-text',
    description: 'Έγγραφα ΓΕΜΗ, ανακοινώσεις και πιστοποιητικά',
    order: 7,
    fields: [
      {
        id: 'documentType',
        label: 'Τύπος Εγγράφου',
        type: 'select',
        options: [
          { value: 'certificate', label: 'Πιστοποιητικό' },
          { value: 'announcement', label: 'Ανακοίνωση' },
          { value: 'registration', label: 'Έγγραφο Σύστασης' },
          { value: 'amendment', label: 'Τροποποίηση Καταστατικού' }
        ],
        helpText: 'Κατηγορία εγγράφου ΓΕΜΗ',
      },
      {
        id: 'documentDate',
        label: 'Ημερομηνία Εγγράφου',
        type: 'date',
        helpText: 'Ημερομηνία έκδοσης εγγράφου',
      },
      {
        id: 'documentSubject',
        label: 'Θέμα Εγγράφου',
        type: 'input',
        helpText: 'Περιγραφή θέματος εγγράφου',
      },
      {
        id: 'documentUrl',
        label: 'Link Εγγράφου',
        type: 'input',
        helpText: 'URL για download εγγράφου',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 8. ΑΠΟΦΑΣΕΙΣ ΟΡΓΑΝΩΝ
  // -------------------------------------------------------------------------
  {
    id: 'decisions',
    title: 'Αποφάσεις Οργάνων',
    icon: 'gavel',
    description: 'Αποφάσεις Γενικών Συνελεύσεων και Διοικητικών Συμβουλίων',
    order: 8,
    fields: [
      {
        id: 'decisionDate',
        label: 'Ημερομηνία Απόφασης',
        type: 'date',
        helpText: 'Ημερομηνία λήψης απόφασης',
      },
      {
        id: 'organType',
        label: 'Όργανο',
        type: 'select',
        options: [
          { value: 'general_assembly', label: 'Γενική Συνέλευση' },
          { value: 'board_directors', label: 'Διοικητικό Συμβούλιο' },
          { value: 'supervisory_board', label: 'Εποπτικό Συμβούλιο' }
        ],
        helpText: 'Όργανο που έλαβε την απόφαση',
      },
      {
        id: 'decisionSubject',
        label: 'Θέμα Απόφασης',
        type: 'input',
        helpText: 'Περιγραφή θέματος απόφασης',
      },
      {
        id: 'protocolNumber',
        label: 'Αριθμός Πρωτοκόλλου',
        type: 'input',
        helpText: 'Αριθμός πρωτοκόλλου απόφασης',
      },
      {
        id: 'decisionSummary',
        label: 'Περίληψη',
        type: 'textarea',
        helpText: 'Σύντομη περίληψη απόφασης',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 9. ΙΣΤΟΡΙΚΟ & ΜΕΤΑΒΟΛΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'companyVersions',
    title: 'Ιστορικό & Μεταβολές',
    icon: 'history',
    description: 'Ιστορικό εκδόσεων και μεταβολών εταιρείας',
    order: 9,
    fields: [
      {
        id: 'versionDate',
        label: 'Ημερομηνία Μεταβολής',
        type: 'date',
        helpText: 'Ημερομηνία καταχώρησης μεταβολής',
      },
      {
        id: 'changeDescription',
        label: 'Περιγραφή Μεταβολής',
        type: 'input',
        helpText: 'Περιγραφή της μεταβολής (π.χ. αλλαγή επωνυμίας)',
      },
      {
        id: 'previousValue',
        label: 'Προηγούμενη Τιμή',
        type: 'input',
        helpText: 'Προηγούμενη τιμή πεδίου (αν εφαρμόζεται)',
      },
      {
        id: 'newValue',
        label: 'Νέα Τιμή',
        type: 'input',
        helpText: 'Νέα τιμή μετά τη μεταβολή',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 10. ΕΚΠΡΟΣΩΠΟΙ & ΔΙΟΙΚΗΣΗ
  // -------------------------------------------------------------------------
  {
    id: 'representatives',
    title: 'Εκπρόσωποι & Διοίκηση',
    icon: 'user-check',
    description: 'Νόμιμοι εκπρόσωποι και διοικητικά στελέχη',
    order: 10,
    fields: [
      {
        id: 'representativeFullName',
        label: 'Πλήρες Όνομα',
        type: 'input',
        helpText: 'Ονοματεπώνυμο εκπροσώπου',
      },
      {
        id: 'representativeRole',
        label: 'Ιδιότητα/Θέση',
        type: 'select',
        options: [
          { value: 'ceo', label: 'Διευθύνων Σύμβουλος' },
          { value: 'president', label: 'Πρόεδρος Δ.Σ.' },
          { value: 'manager', label: 'Διαχειριστής' },
          { value: 'legal_rep', label: 'Νόμιμος Εκπρόσωπος' },
          { value: 'secretary', label: 'Γραμματέας' }
        ],
        helpText: 'Θέση ή ιδιότητα στην εταιρεία',
      },
      {
        id: 'representativeTaxNumber',
        label: 'ΑΦΜ Εκπροσώπου',
        type: 'input',
        maxLength: 9,
        helpText: 'Αριθμός Φορολογικού Μητρώου εκπροσώπου',
      },
      {
        id: 'representativeTaxOffice',
        label: 'ΔΟΥ',
        type: 'input',
        helpText: 'Δημόσια Οικονομική Υπηρεσία',
      },
      {
        id: 'representativeEmail',
        label: 'Email',
        type: 'email',
        helpText: 'Email επικοινωνίας εκπροσώπου',
      },
      {
        id: 'representativePhone',
        label: 'Τηλέφωνο',
        type: 'tel',
        helpText: 'Τηλέφωνο επικοινωνίας εκπροσώπου',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 11. ΑΝΑΚΟΙΝΩΣΕΙΣ & ΔΗΜΟΣΙΕΥΣΕΙΣ
  // -------------------------------------------------------------------------
  {
    id: 'announcements',
    title: 'Ανακοινώσεις & Δημοσιεύσεις',
    icon: 'megaphone',
    description: 'Ανακοινώσεις εταιρείας και δημοσιεύσεις σε επίσημα φύλλα',
    order: 11,
    fields: [
      {
        id: 'announcementDate',
        label: 'Ημερομηνία Ανακοίνωσης',
        type: 'date',
        helpText: 'Ημερομηνία δημοσίευσης ανακοίνωσης',
      },
      {
        id: 'issuePaper',
        label: 'Φύλλο Δημοσίευσης',
        type: 'input',
        helpText: 'Όνομα επίσημου φύλλου (π.χ. ΦΕΚ)',
      },
      {
        id: 'announcementSubject',
        label: 'Θέμα Ανακοίνωσης',
        type: 'input',
        helpText: 'Περιγραφή θέματος ανακοίνωσης',
      },
      {
        id: 'announcementSummary',
        label: 'Περίληψη',
        type: 'textarea',
        helpText: 'Σύντομη περίληψη ανακοίνωσης',
      },
      {
        id: 'announcementFile',
        label: 'Αρχείο Ανακοίνωσης',
        type: 'input',
        helpText: 'Link ή path αρχείου ανακοίνωσης',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 12. ΚΑΤΑΣΤΑΣΕΙΣ & LIFECYCLE
  // -------------------------------------------------------------------------
  {
    id: 'statuses',
    title: 'Καταστάσεις & Lifecycle',
    icon: 'activity',
    description: 'Ιστορικό καταστάσεων εταιρείας (ενεργή, διαγραφείσα κλπ)',
    order: 12,
    fields: [
      {
        id: 'currentStatus',
        label: 'Τρέχουσα Κατάσταση',
        type: 'select',
        options: [
          { value: 'active', label: 'Ενεργή' },
          { value: 'inactive', label: 'Ανενεργή' },
          { value: 'dissolved', label: 'Διαγραφείσα' },
          { value: 'bankruptcy', label: 'Σε Πτώχευση' },
          { value: 'liquidation', label: 'Υπό Εκκαθάριση' }
        ],
        helpText: 'Τρέχουσα κατάσταση εταιρείας',
      },
      {
        id: 'statusChangeDate',
        label: 'Ημερομηνία Αλλαγής',
        type: 'date',
        helpText: 'Ημερομηνία τελευταίας αλλαγής κατάστασης',
      },
      {
        id: 'statusReason',
        label: 'Λόγος Αλλαγής',
        type: 'input',
        helpText: 'Αιτιολογία αλλαγής κατάστασης',
      },
      {
        id: 'previousStatus',
        label: 'Προηγούμενη Κατάσταση',
        type: 'input',
        helpText: 'Κατάσταση πριν την τελευταία αλλαγή',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 13. ΛΟΓΟΤΥΠΟ & ΦΩΤΟΓΡΑΦΙΕΣ ΕΤΑΙΡΕΙΑΣ
  // -------------------------------------------------------------------------
  {
    id: 'companyPhotos',
    title: 'Λογότυπο & Φωτογραφίες',
    icon: 'image',
    description: 'Λογότυπο εταιρείας και φωτογραφία εκπροσώπου',
    order: 13,
    fields: [
      // Αυτό το tab θα περιέχει το UnifiedPhotoManager component
      // Τα actual photo uploads θα γίνονται από το UnifiedPhotoManager
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