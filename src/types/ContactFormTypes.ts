import type { ContactType } from '@/types/contacts';

export interface AddNewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded: () => void;
  editContact?: Contact | null; // For edit mode
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
  // Φωτογραφία
  photoFile: File | null;
  photoPreview: string;
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
  // Φωτογραφία
  photoFile: null,
  photoPreview: '',
  // Κοινά
  notes: '',
};