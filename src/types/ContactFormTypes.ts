import type { ContactType } from '@/types/contacts';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

export interface AddNewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded: () => void;
  editContact?: Contact | null; // For edit mode
  onLiveChange?: (updatedContact: Contact) => void; // 🔥 NEW: For real-time preview
}

// Import Contact type
import type { Contact } from '@/types/contacts';

export interface ContactFormData {
  type: ContactType;
  // Βασικά Στοιχεία Φυσικού Προσώπου
  firstName: string;
  lastName: string;
  fatherName: string;
  motherName: string;
  birthDate: string;
  birthCountry: string;
  gender: 'male' | 'female' | 'other' | '';
  amka: string;
  // Ταυτότητα & ΑΦΜ
  documentType: string;
  documentIssuer: string;
  documentNumber: string;
  documentIssueDate: string;
  documentExpiryDate: string;
  vatNumber: string;
  taxOffice: string;
  // Επικοινωνία & Socials
  email: string;
  phone: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
  };
  websites: string;
  // Επαγγελματικά
  profession: string;
  specialty: string;
  employer: string;
  position: string;
  workAddress: string;
  workWebsite: string;
  // Εταιρεία
  companyName: string;
  companyVatNumber: string;
  // Υπηρεσία - Στοιχεία από ΓΕΜΗ
  serviceName: string;
  serviceType: 'ministry' | 'tax_office' | 'municipality' | 'public_organization' | 'other';
  // Service Config Support - Generic name field για service-config compatibility
  name: string;
  // Βασικά Στοιχεία Δημόσιας Υπηρεσίας (Service Config)
  shortName: string; // Συντομογραφία
  category: string; // Κατηγορία Φορέα
  supervisionMinistry: string; // Εποπτεύον Υπουργείο
  // Διοικητικά Στοιχεία (Service Config)
  legalStatus: string; // Νομικό Καθεστώς
  establishmentLaw: string; // Νόμος Ίδρυσης
  headTitle: string; // Τίτλος Προϊσταμένου
  headName: string; // Όνομα Προϊσταμένου
  // Γενικά Στοιχεία ΓΕΜΗ (basicInfo)
  gemiNumber: string;
  serviceVatNumber: string;
  serviceTaxOffice: string;
  serviceTitle: string;
  tradeName: string; // Διακριτικός Τίτλος
  legalForm: string;
  gemiStatus: string;
  gemiStatusDate: string;
  chamber: string; // Επιμελητήριο / Τ.Υ. ΓΕΜΗ
  isBranch: boolean; // Υποκατάστημα ένδειξη
  registrationMethod: string; // Τρόπος Εγγραφής
  // Πρόσθετα από ΓΕΜΗ API
  registrationDate: string;
  lastUpdateDate: string;
  gemiDepartment: string; // Τοπική υπηρεσία ΓΕΜΗ
  prefecture: string; // Νομός
  municipality: string; // Δήμος
  activityCodeKAD: string; // ΚΑΔ κωδικός
  activityDescription: string; // Περιγραφή δραστηριότητας
  activityType: 'main' | 'secondary'; // Κύρια/Δευτερεύουσα
  activityValidFrom: string;
  activityValidTo: string;
  // Κεφάλαιο (capital)
  capitalAmount: string;
  currency: string;
  extraordinaryCapital: string; // Εξωλογιστικά / Εγγυητικά
  // Στοιχεία Φορέα
  serviceCode: string;
  parentMinistry: string;
  serviceCategory: string;
  officialWebsite: string;
  // Επικοινωνία Υπηρεσίας (Contact Section)
  address: string;
  postalCode: string;
  city: string;
  fax: string;
  website: string;
  // Υπηρεσίες Φορέα (Services Section)
  mainResponsibilities: string;
  citizenServices: string;
  onlineServices: string;
  serviceHours: string;
  // Διεύθυνση Έδρας
  serviceAddress: {
    street: string;
    number: string;
    postalCode: string;
    city: string;
  };
  // Εκπρόσωποι/Υπεύθυνοι (representatives)
  representatives: {
    name: string;
    role: string;
    email: string;
    phone: string;
    taxNumber: string;
    taxOffice: string;
  }[];
  // Μετοχική σύνθεση (shareholders)
  shareholders: {
    shareholderName: string;
    shareholderType: 'individual' | 'legal';
    idNumber: string;
    taxNumber: string;
    shareType: string;
    quantity: string;
    percentage: string;
    nominalValue: string;
  }[];
  // Υποκαταστήματα (branches)
  branches: {
    address: {
      street: string;
      number: string;
      postalCode: string;
      city: string;
    };
    status: string;
    establishedDate: string;
  }[];
  // Έγγραφα ΓΕΜΗ (documents)
  documents: {
    announcementDocs: {
      publishDate: string;
      organ: string;
      subject: string;
      attachment: string;
    }[];
    registrationDocs: {
      code: string;
      downloadLink: string;
      subject: string;
    }[];
  };
  // Αποφάσεις Οργάνων (decisions)
  decisions: {
    decisionDate: string;
    organType: string;
    subject: string;
    protocolNumber: string;
    summary: string;
  }[];
  // Ανακοινώσεις (announcements)
  announcements: {
    announcementDate: string;
    issuePaper: string;
    summary: string;
    announcementFile: string;
  }[];
  // Λογότυπο
  logoFile: File | null;
  logoPreview: string;
  logoURL?: string; // Upload URL for stored logo
  logoFileName?: string; // Custom filename για λογότυπο
  // Φωτογραφία
  photoFile: File | null;
  photoPreview: string;
  photoURL?: string; // Upload URL for stored photo
  photoFileName?: string; // Custom filename για φωτογραφία εκπροσώπου
  // Πολλαπλές Φωτογραφίες (μέχρι 6 για Individual)
  multiplePhotos: PhotoSlot[];
  // Επιλεγμένη φωτογραφία προφίλ (για Individual - index από multiplePhotos)
  selectedProfilePhotoIndex?: number;
  // Κοινά
  notes: string;
}

export const initialFormData: ContactFormData = {
  type: 'individual',
  // Βασικά Στοιχεία
  firstName: '',
  lastName: '',
  fatherName: '',
  motherName: '',
  birthDate: '',
  birthCountry: '',
  gender: '',
  amka: '',
  // Ταυτότητα & ΑΦΜ
  documentType: '',
  documentIssuer: '',
  documentNumber: '',
  documentIssueDate: '',
  documentExpiryDate: '',
  vatNumber: '',
  taxOffice: '',
  // Επικοινωνία & Socials
  email: '',
  phone: '',
  socialMedia: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
  },
  websites: '',
  // Επαγγελματικά
  profession: '',
  specialty: '',
  employer: '',
  position: '',
  workAddress: '',
  workWebsite: '',
  // Εταιρεία
  companyName: '',
  companyVatNumber: '',
  // Υπηρεσία - Στοιχεία από ΓΕΜΗ
  serviceName: '',
  serviceType: 'other',
  // Service Config Support
  name: '',
  // Βασικά Στοιχεία Δημόσιας Υπηρεσίας (Service Config)
  shortName: '',
  category: '',
  supervisionMinistry: '',
  // Διοικητικά Στοιχεία (Service Config)
  legalStatus: '',
  establishmentLaw: '',
  headTitle: '',
  headName: '',
  // Γενικά Στοιχεία ΓΕΜΗ (basicInfo)
  gemiNumber: '',
  serviceVatNumber: '',
  serviceTaxOffice: '',
  serviceTitle: '',
  tradeName: '',
  legalForm: '',
  gemiStatus: '',
  gemiStatusDate: '',
  chamber: '',
  isBranch: false,
  registrationMethod: '',
  // Πρόσθετα από ΓΕΜΗ API
  registrationDate: '',
  lastUpdateDate: '',
  gemiDepartment: '',
  prefecture: '',
  municipality: '',
  activityCodeKAD: '',
  activityDescription: '',
  activityType: 'main',
  activityValidFrom: '',
  activityValidTo: '',
  // Κεφάλαιο (capital)
  capitalAmount: '',
  currency: '',
  extraordinaryCapital: '',
  // Στοιχεία Φορέα
  serviceCode: '',
  parentMinistry: '',
  serviceCategory: '',
  officialWebsite: '',
  // Επικοινωνία Υπηρεσίας (Contact Section)
  address: '',
  postalCode: '',
  city: '',
  fax: '',
  website: '',
  // Υπηρεσίες Φορέα (Services Section)
  mainResponsibilities: '',
  citizenServices: '',
  onlineServices: '',
  serviceHours: '',
  // Διεύθυνση Έδρας
  serviceAddress: {
    street: '',
    number: '',
    postalCode: '',
    city: '',
  },
  // Εκπρόσωποι/Υπεύθυνοι (representatives)
  representatives: [],
  // Μετοχική σύνθεση (shareholders)
  shareholders: [],
  // Υποκαταστήματα (branches)
  branches: [],
  // Έγγραφα ΓΕΜΗ (documents)
  documents: {
    announcementDocs: [],
    registrationDocs: []
  },
  // Αποφάσεις Οργάνων (decisions)
  decisions: [],
  // Ανακοινώσεις (announcements)
  announcements: [],
  // Λογότυπο
  logoFile: null,
  logoPreview: '',
  logoURL: '',
  // Φωτογραφία
  photoFile: null,
  photoPreview: '',
  photoURL: '',
  // Πολλαπλές Φωτογραφίες (μέχρι 6 για Individual)
  multiplePhotos: [],
  // Επιλεγμένη φωτογραφία προφίλ (default: 0 = πρώτη φωτογραφία)
  selectedProfilePhotoIndex: undefined,
  // Κοινά
  notes: '',
};