'use client';

// ============================================================================
// SERVICE CONFIGURATION - TABS FOR ΔΗΜΟΣΙΕΣ ΥΠΗΡΕΣΙΕΣ
// ============================================================================
//
// Κεντρικοποιημένη διαμόρφωση για δημόσιες υπηρεσίες με tab layout
// Αντικαθιστά τα ΓΕΜΙ fields που δεν ισχύουν για δημόσιους φορείς
//
// ============================================================================

export interface ServiceFieldConfig {
  id: string;
  type: 'input' | 'textarea' | 'select' | 'email' | 'tel' | 'number' | 'date';
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

/**
 * Βασικά Στοιχεία Δημόσιας Υπηρεσίας
 */
const basicInfoSection: ServiceSectionConfig = {
  id: 'basicInfo',
  title: 'Βασικά Στοιχεία',
  icon: 'landmark',
  fields: [
    {
      id: 'name',
      type: 'input',
      label: 'Επωνυμία Υπηρεσίας',
      placeholder: 'π.χ. Δήμος Αθηναίων',
      required: true,
      helpText: 'Η επίσημη επωνυμία του δημόσιου φορέα'
    },
    {
      id: 'shortName',
      type: 'input',
      label: 'Συντομογραφία',
      placeholder: 'π.χ. Δ.Α.',
      helpText: 'Συντομογραφία ή ακρωνύμιο της υπηρεσίας'
    },
    {
      id: 'category',
      type: 'select',
      label: 'Κατηγορία Φορέα',
      required: true,
      options: [
        { value: 'ministry', label: 'Υπουργείο' },
        { value: 'region', label: 'Περιφέρεια' },
        { value: 'municipality', label: 'Δήμος' },
        { value: 'public_entity', label: 'Δημόσιος Οργανισμός' },
        { value: 'independent_authority', label: 'Ανεξάρτητη Αρχή' },
        { value: 'university', label: 'Πανεπιστήμιο' },
        { value: 'hospital', label: 'Νοσοκομείο' },
        { value: 'school', label: 'Εκπαιδευτικό Ίδρυμα' },
        { value: 'other', label: 'Άλλο' }
      ]
    },
    {
      id: 'supervisionMinistry',
      type: 'input',
      label: 'Εποπτεύον Υπουργείο',
      placeholder: 'π.χ. Υπουργείο Εσωτερικών',
      helpText: 'Το υπουργείο που εποπτεύει την υπηρεσία'
    }
  ]
};

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
      label: 'Νομικό Καθεστώς',
      required: true,
      options: [
        { value: 'npdd', label: 'Νομικό Πρόσωπο Δημοσίου Δικαίου (Ν.Π.Δ.Δ.)' },
        { value: 'npid', label: 'Νομικό Πρόσωπο Ιδιωτικού Δικαίου (Ν.Π.Ι.Δ.)' },
        { value: 'public_service', label: 'Δημόσια Υπηρεσία' },
        { value: 'independent_authority', label: 'Ανεξάρτητη Αρχή' },
        { value: 'decentralized_admin', label: 'Αποκεντρωμένη Διοίκηση' }
      ]
    },
    {
      id: 'establishmentLaw',
      type: 'input',
      label: 'Νόμος Ίδρυσης',
      placeholder: 'π.χ. Ν. 3852/2010',
      helpText: 'Ο νόμος που ίδρυσε ή διέπει την υπηρεσία'
    },
    {
      id: 'headTitle',
      type: 'input',
      label: 'Τίτλος Προϊσταμένου',
      placeholder: 'π.χ. Δήμαρχος, Γενικός Διευθυντής',
      helpText: 'Ο τίτλος του υψηλότερου ιεραρχικά υπευθύνου'
    },
    {
      id: 'headName',
      type: 'input',
      label: 'Όνομα Προϊσταμένου',
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
      id: 'address',
      type: 'textarea',
      label: 'Διεύθυνση Έδρας',
      placeholder: 'Πλήρη διεύθυνση',
      required: true,
      helpText: 'Η επίσημη διεύθυνση της έδρας της υπηρεσίας'
    },
    {
      id: 'postalCode',
      type: 'input',
      label: 'Τ.Κ.',
      placeholder: '12345',
      maxLength: 5
    },
    {
      id: 'city',
      type: 'input',
      label: 'Πόλη',
      placeholder: 'Αθήνα',
      required: true
    },
    {
      id: 'phone',
      type: 'tel',
      label: 'Τηλέφωνο Κεντρικής',
      placeholder: '2101234567',
      helpText: 'Κεντρικό τηλέφωνο της υπηρεσίας'
    },
    {
      id: 'fax',
      type: 'tel',
      label: 'Fax',
      placeholder: '2101234568'
    },
    {
      id: 'email',
      type: 'email',
      label: 'E-mail Επικοινωνίας',
      placeholder: 'info@service.gov.gr',
      helpText: 'Κεντρικό email της υπηρεσίας'
    },
    {
      id: 'website',
      type: 'input',
      label: 'Ιστοσελίδα',
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
      label: 'Κύριες Αρμοδιότητες',
      placeholder: 'Περιγράψτε τις κύριες αρμοδιότητες της υπηρεσίας...',
      required: true,
      helpText: 'Οι βασικές αρμοδιότητες και υποχρεώσεις της υπηρεσίας'
    },
    {
      id: 'citizenServices',
      type: 'textarea',
      label: 'Υπηρεσίες προς Πολίτες',
      placeholder: 'Περιγράψτε τις υπηρεσίες που προσφέρονται στους πολίτες...',
      helpText: 'Συγκεκριμένες υπηρεσίες που μπορούν να λάβουν οι πολίτες'
    },
    {
      id: 'onlineServices',
      type: 'input',
      label: 'Ηλεκτρονικές Υπηρεσίες',
      placeholder: 'https://gov.gr-connect',
      helpText: 'Link για ηλεκτρονικές υπηρεσίες (gov.gr, κλπ)'
    },
    {
      id: 'serviceHours',
      type: 'input',
      label: 'Ώρες Εξυπηρέτησης',
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