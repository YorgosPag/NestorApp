'use client';

import { COMPANY_LEGAL_FORM_LABELS } from '@/constants/property-statuses-enterprise';

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
 */
const basicInfoSection: CompanySectionConfig = {
  id: 'basicInfo',
  title: 'Βασικά Στοιχεία',
  icon: 'building',
  fields: [
    {
      id: 'companyName',
      type: 'input',
      label: 'Επωνυμία Εταιρείας',
      placeholder: 'π.χ. ALPHA ΒANK Α.Ε.',
      required: true,
      helpText: 'Η επίσημη επωνυμία της εταιρείας'
    },
    {
      id: 'tradeName',
      type: 'input',
      label: 'Διακριτικός Τίτλος',
      placeholder: 'π.χ. Alpha Bank',
      helpText: 'Εμπορικός τίτλος (αν διαφέρει από την επωνυμία)'
    },
    {
      id: 'legalForm',
      type: 'select',
      label: 'Νομική Μορφή',
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
      label: 'ΑΦΜ',
      placeholder: '123456789',
      maxLength: 9,
      required: true,
      helpText: 'Αριθμός Φορολογικού Μητρώου (9 ψηφία)'
    }
  ]
};

/**
 * ΓΕΜΗ Στοιχεία
 */
const gemiSection: CompanySectionConfig = {
  id: 'gemi',
  title: 'ΓΕΜΗ Στοιχεία',
  icon: 'file-text',
  fields: [
    {
      id: 'gemiNumber',
      type: 'input',
      label: 'Αριθμός ΓΕΜΗ',
      placeholder: '123456789',
      helpText: 'Αριθμός εγγραφής στο Γενικό Εμπορικό Μητρώο'
    },
    {
      id: 'gemiStatus',
      type: 'select',
      label: 'Κατάσταση ΓΕΜΗ',
      options: [
        { value: 'active', label: 'Ενεργή' },
        { value: 'inactive', label: 'Ανενεργή' },
        { value: 'suspended', label: 'Αναστολή Λειτουργίας' },
        { value: 'dissolution', label: 'Σε Διαδικασία Λύσης' }
      ]
    },
    {
      id: 'chamber',
      type: 'input',
      label: 'Επιμελητήριο',
      placeholder: 'π.χ. Επιμελητήριο Αθηνών',
      helpText: 'Το επιμελητήριο στο οποίο είναι εγγεγραμμένη'
    },
    {
      id: 'activityCodeKAD',
      type: 'input',
      label: 'Κωδικός Δραστηριότητας (ΚΑΔ)',
      placeholder: 'π.χ. 62.01',
      helpText: 'Κύριος κωδικός δραστηριότητας'
    },
    {
      id: 'activityDescription',
      type: 'textarea',
      label: 'Περιγραφή Δραστηριότητας',
      placeholder: 'Περιγράψτε τις κύριες δραστηριότητες της εταιρείας...',
      helpText: 'Σύντομη περιγραφή των επιχειρηματικών δραστηριοτήτων'
    }
  ]
};

/**
 * Στοιχεία Επικοινωνίας
 */
const contactSection: CompanySectionConfig = {
  id: 'contact',
  title: 'Στοιχεία Επικοινωνίας',
  icon: 'phone',
  fields: [
    {
      id: 'street',
      type: 'input',
      label: 'Οδός',
      placeholder: 'π.χ. Πανεπιστημίου',
      required: true,
      helpText: 'Όνομα οδού χωρίς αριθμό'
    },
    {
      id: 'streetNumber',
      type: 'input',
      label: 'Αριθμός',
      placeholder: 'π.χ. 125',
      required: true,
      helpText: 'Αριθμός οδού (μπορεί να περιλαμβάνει γράμματα π.χ. 25Α)'
    },
    {
      id: 'city',
      type: 'input',
      label: 'Πόλη',
      placeholder: `π.χ. ${process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Αθήνα'}`,
      required: true,
      helpText: 'Πόλη όπου βρίσκεται η έδρα'
    },
    {
      id: 'postalCode',
      type: 'input',
      label: 'Τ.Κ.',
      placeholder: '12345',
      maxLength: 5,
      required: true,
      helpText: 'Ταχυδρομικός κώδικας (5 ψηφία)'
    },
    {
      id: 'phone',
      type: 'tel',
      label: 'Τηλέφωνο Κεντρικής',
      placeholder: '2101234567',
      helpText: 'Κεντρικό τηλέφωνο της εταιρείας'
    },
    {
      id: 'email',
      type: 'email',
      label: 'E-mail Επικοινωνίας',
      placeholder: 'info@company.gr',
      helpText: 'Κεντρικό email της εταιρείας'
    },
    {
      id: 'website',
      type: 'url',
      label: 'Ιστοσελίδα',
      placeholder: 'https://www.company.gr',
      helpText: 'Επίσημη ιστοσελίδα της εταιρείας'
    }
  ]
};

/**
 * Λογότυπο
 */
const logoSection: CompanySectionConfig = {
  id: 'logo',
  title: 'Λογότυπο',
  icon: 'image',
  fields: [
    // Λογότυπο θα renderάρεται χωρίς επιπλέον fields
  ]
};

// -------------------------------------------------------------------------
// 6. ΣΧΕΣΕΙΣ - 🏢 ENTERPRISE RELATIONSHIP MANAGEMENT
// -------------------------------------------------------------------------
const relationshipsSection: CompanySectionConfig = {
  id: 'relationships',
  title: 'Εργαζόμενοι & Οργάνωση',
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