import type { ContactType, PhoneInfo, EmailInfo, WebsiteInfo, SocialMediaInfo, CompanyContact } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { ContactAddressType } from '@/types/contacts/address-types';

export interface AddNewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded: () => void;
  editContact?: Contact | null; // For edit mode
  onLiveChange?: (updatedContact: Contact) => void; // 🔥 NEW: For real-time preview
  /** Filter available contact types (default: all 3) */
  allowedContactTypes?: ContactType[];
  /** Personas to auto-activate on new contact creation */
  defaultPersonas?: PersonaType[];
  /**
   * Shell style. `dialog` (default) = centered modal; `sheet` = right-side
   * slide-over. Use `sheet` when nesting under another slide-over (e.g.
   * creating a Company while creating a Project) for consistent UX.
   */
  presentation?: 'dialog' | 'sheet';
}

// Import Contact type
import type { Contact } from '@/types/contacts';

/** Individual address types */
export type IndividualAddressType = 'home' | 'work' | 'vacation' | 'other';

/** Single individual address entry */
export interface IndividualAddress {
  type: IndividualAddressType;
  street: string;
  number: string;
  postalCode: string;
  city: string;
  region?: string;
  settlementId?: string | null;
  communityName?: string;
  municipalUnitName?: string;
  municipalityName?: string;
  municipalityId?: string | null;
  regionalUnitName?: string;
  regionName?: string;
  decentAdminName?: string;
  majorGeoName?: string;
}

/** Single company address entry */
export interface CompanyAddress {
  /**
   * Address semantic type (ADR-319 SSoT: `ContactAddressType`).
   * Wider than the legacy `headquarters | branch` pair so individuals can
   * pick `home`/`vacation`/`office` and companies can pick
   * `warehouse`/`showroom`/`factory`/... — `getAddressTypesForContact` in
   * `src/types/contacts/address-types.ts` returns the allowed set per
   * contact type.
   */
  type: ContactAddressType;
  /** Free-text label when `type === 'other'`. Ignored otherwise. */
  customLabel?: string;
  street: string;
  number: string;
  postalCode: string;
  city: string;
  region?: string;
  /** Greek administrative hierarchy (optional — auto-filled from AddressWithHierarchy) */
  settlementId?: string | null;
  communityName?: string;
  municipalUnitName?: string;
  municipalityName?: string;
  municipalityId?: string | null;
  regionalUnitName?: string;
  regionName?: string;
  decentAdminName?: string;
  majorGeoName?: string;
}

/** Single KAD activity entry — primary or secondary */
export interface KadActivity {
  code: string;
  description: string;
  type: 'primary' | 'secondary';
  activeFrom?: string;
}

export interface ContactFormData {
  type: ContactType;
  id?: string; // 🔥 CRITICAL: Contact ID for relationship management
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
  // Επικοινωνία & Socials (Legacy flat fields)
  email: string;
  phone: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
  };

  // 🚀 DYNAMIC ARRAYS: Enterprise contact management
  phones?: PhoneInfo[];
  emails?: EmailInfo[];
  websites?: WebsiteInfo[];
  socialMediaArray?: SocialMediaInfo[];

  // Address fields (separate from arrays — legacy singular)
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  /**
   * Semantic type for the primary (flat-field) address — ADR-319.
   * Defaults to `home` for individuals and `headquarters` for company/service.
   * When `other`, `primaryAddressCustomLabel` carries the free-text label.
   */
  primaryAddressType?: ContactAddressType;
  /** Free-text label when `primaryAddressType === 'other'`. */
  primaryAddressCustomLabel?: string;
  /** Multi-address array for companies */
  companyAddresses?: CompanyAddress[];
  /** Multi-address array for individuals (home, work, vacation, other) */
  individualAddresses?: IndividualAddress[];
  // Επαγγελματικά
  profession: string;
  specialty: string;
  employer: string;
  employerId: string;         // ID σύνδεσης με Company contact (ADR-177)
  position: string;
  workAddress: string;
  workWebsite: string;
  // 🇪🇺 ESCO Professional Classification (ADR-034)
  escoUri: string;
  escoLabel: string;
  iscoCode: string;
  // 🇪🇺 ESCO Skills (ADR-132)
  escoSkills: Array<{ uri: string; label: string }>;
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
  legalForm: CompanyContact['legalForm'] | '';
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
  // Administrative Hierarchy (Διοικητική Διαίρεση)
  municipalityId: string | null;
  regionalUnit: string;
  region: string;
  decentAdmin: string;
  majorGeo: string;
  settlement: string;
  settlementId: string | null;
  community: string;
  municipalUnit: string;
  activityCodeKAD: string; // ΚΑΔ κωδικός (legacy singular)
  activityDescription: string; // Περιγραφή δραστηριότητας (legacy singular)
  activityType: 'main' | 'secondary'; // Κύρια/Δευτερεύουσα (legacy singular)
  /** Multi-KAD activities array — primary + secondary */
  activities?: KadActivity[];
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

  // 🔥 ENTERPRISE UPLOAD STATE TRACKING (για synchronization)
  // Internal tracking fields - ΔΕΝ αποθηκεύονται στη βάση
  _isLogoUploading?: boolean;    // Logo upload in progress
  _isPhotoUploading?: boolean;   // Representative photo upload in progress
  _forceDeleteLogo?: number;     // Timestamp για force logo deletion state reset

  // Κοινά
  notes: string;

  // 🏢 ENTERPRISE: Properties from Contact type for union compatibility (2026-01-20)
  /** Contact status */
  status?: 'active' | 'inactive' | 'archived';
  /** Favorite flag */
  isFavorite?: boolean;
  /** Creation timestamp */
  createdAt?: Date | string;
  /** Update timestamp */
  updatedAt?: Date | string;

  // 🏢 ENTERPRISE: ΓΕΜΗ properties shortcuts/aliases (2026-01-20)
  /** ΑΦΜ - Greek tax number (alias for vatNumber for GEMI API compatibility) */
  afm?: string;
  /** Distinctive title / Trading name */
  distintiveTitle?: string;
  /** KAD code for activity classification */
  kadCode?: string;
  /** Capital amount */
  capital?: string | number;
  /** Extra-balance capital / Guarantees */
  extrabalanceCapital?: string | number;

  // 🎭 ENTERPRISE: Contact Persona System (ADR-121)
  /** Active persona types for this individual contact */
  activePersonas: PersonaType[];
  /** Persona-specific field data, keyed by PersonaType */
  personaData: Partial<Record<PersonaType, Record<string, string | number | null>>>;
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
  // Επικοινωνία & Socials (Legacy)
  email: '',
  phone: '',
  socialMedia: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
  },

  // 🚀 DYNAMIC ARRAYS: Enterprise contact management
  phones: [],
  emails: [],
  websites: [],
  socialMediaArray: [],

  // Address fields
  street: '',
  streetNumber: '',
  city: '',
  postalCode: '',
  companyAddresses: [],
  // Επαγγελματικά
  profession: '',
  specialty: '',
  employer: '',
  employerId: '',
  position: '',
  workAddress: '',
  workWebsite: '',
  // 🇪🇺 ESCO Professional Classification (ADR-034)
  escoUri: '',
  escoLabel: '',
  iscoCode: '',
  // 🇪🇺 ESCO Skills (ADR-132)
  escoSkills: [],
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
  municipalityId: null,
  regionalUnit: '',
  region: '',
  decentAdmin: '',
  majorGeo: '',
  settlement: '',
  settlementId: null,
  community: '',
  municipalUnit: '',
  activityCodeKAD: '',
  activityDescription: '',
  activityType: 'main',
  activities: [],
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

  // 🎭 Persona System (ADR-121)
  activePersonas: [],
  personaData: {},
};
