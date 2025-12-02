// Type definitions for contacts, decoupled from Firebase SDK.

export type FirestoreishTimestamp = Date | { toDate: () => Date };

// Βασικοί τύποι επαφών
export type ContactType = 'individual' | 'company' | 'service';
export type ContactStatus = 'active' | 'inactive' | 'archived';

// Βασικό interface για όλες τις επαφές
export interface BaseContact {
  id?: string;
  type: ContactType;
  isFavorite: boolean;
  status: ContactStatus;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, any>;
  createdAt: FirestoreishTimestamp;
  updatedAt: FirestoreishTimestamp;
  createdBy?: string;
  lastModifiedBy?: string;
}

// Interface για Φυσικά Πρόσωπα
export interface IndividualContact extends BaseContact {
  type: 'individual';

  // 👤 Βασικά Στοιχεία
  firstName: string;
  lastName: string;
  fatherName?: string;        // Πατρώνυμο
  motherName?: string;        // Μητρώνυμο
  middleName?: string;        // Μεσαίο όνομα (legacy)
  nickname?: string;          // Παρατσούκλι

  birthDate?: string;         // Ημερομηνία Γέννησης (ISO string)
  birthCountry?: string;      // Χώρα Γέννησης
  gender?: 'male' | 'female' | 'other';  // Φύλο
  amka?: string;             // ΑΜΚΑ

  // 💳 Ταυτότητα & ΑΦΜ
  documentType?: 'identity_card' | 'passport' | 'drivers_license' | 'other';
  documentIssuer?: string;    // Εκδούσα Αρχή
  documentNumber?: string;    // Αριθμός Εγγράφου
  documentIssueDate?: string; // Ημερομηνία Έκδοσης (ISO string)
  documentExpiryDate?: string; // Ημερομηνία Λήξης (ISO string)
  vatNumber?: string;         // ΑΦΜ (Φυσικού Προσώπου)
  taxOffice?: string;         // ΔΟΥ

  // Legacy fields (for backward compatibility)
  dateOfBirth?: Date;         // Deprecated: use birthDate
  nationality?: string;       // Deprecated: use birthCountry
  idNumber?: string;         // Deprecated: use documentNumber
  taxNumber?: string;        // Deprecated: use vatNumber
  socialSecurityNumber?: string; // Deprecated: use amka

  // 💼 Επαγγελματικά Στοιχεία
  profession?: string;        // Επάγγελμα
  specialty?: string;         // Ειδικότητα
  employer?: string;          // Επιχείρηση/Εργοδότης
  position?: string;          // Θέση/Ρόλος
  workAddress?: string;       // Διεύθυνση Εργασίας
  workWebsite?: string;       // Ιστοσελίδα Επαγγελματικού Προφίλ

  // Legacy professional fields (for backward compatibility)
  jobTitle?: string;         // Deprecated: use position
  company?: string;          // Deprecated: use employer
  department?: string;       // Keep for department within employer

  // 📞 Στοιχεία επικοινωνίας
  emails?: EmailInfo[];
  phones?: PhoneInfo[];
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];
  socialMedia?: SocialMediaInfo[];

  // 👨‍👩‍👧‍👦 Οικογενειακή κατάσταση
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  spouse?: string;
  children?: string[];

  // 📷 Φωτογραφίες
  photoURL?: string;
  multiplePhotoURLs?: string[]; // Πολλαπλές φωτογραφίες (έως 5)
}

// Interface για Νομικά Πρόσωπα (Εταιρείες)
export interface CompanyContact extends BaseContact {
  type: 'company';
  // Βασικά στοιχεία εταιρείας
  companyName: string;
  legalName?: string;
  tradeName?: string;
  
  // Νομικά στοιχεία
  legalForm?: 'ΑΕ' | 'ΕΠΕ' | 'ΟΕ' | 'ΕΕ' | 'ΙΚΕ' | 'ΚΟΙΝΣΕΠ' | 'OTHER';
  vatNumber: string; // ΑΦΜ
  registrationNumber?: string; // ΓΕΜΗ
  taxOffice?: string; // ΔΟΥ
  
  // Πληροφορίες εταιρείας
  industry?: string;
  sector?: string;
  numberOfEmployees?: number;
  annualRevenue?: number;
  foundedDate?: Date;
  
  // Στοιχεία επικοινωνίας
  emails?: EmailInfo[];
  phones?: PhoneInfo[];
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];
  socialMedia?: SocialMediaInfo[];
  
  // Υπεύθυνοι επικοινωνίας
  contactPersons?: ContactPerson[];
  
  // Λογότυπο
  logoURL?: string;
}

// Interface για Δημόσιες Υπηρεσίες
export interface ServiceContact extends BaseContact {
  type: 'service';
  // Βασικά στοιχεία υπηρεσίας
  serviceName: string;
  serviceType: 'ministry' | 'tax_office' | 'municipality' | 'public_organization' | 'other';
  parentOrganization?: string;
  
  // Κωδικοί και μητρώα
  serviceCode?: string;
  registryNumber?: string;
  
  // Πληροφορίες υπηρεσίας
  department?: string;
  division?: string;
  responsibleMinistry?: string;
  
  // Ωράριο λειτουργίας
  operatingHours?: OperatingHours;
  
  // Στοιχεία επικοινωνίας
  emails?: EmailInfo[];
  phones?: PhoneInfo[];
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];
  
  // Αρμόδιοι
  responsiblePersons?: ResponsiblePerson[];
  
  // Παρεχόμενες υπηρεσίες
  servicesProvided?: string[];
  
  // Λογότυπο
  logoURL?: string;
}

// Auxiliary Types
export interface EmailInfo {
  email: string;
  type: 'personal' | 'work' | 'other';
  isPrimary: boolean;
  label?: string;
}

export interface PhoneInfo {
  number: string;
  type: 'mobile' | 'home' | 'work' | 'fax' | 'other';
  isPrimary: boolean;
  label?: string;
  countryCode?: string;
}

export interface AddressInfo {
  street: string;
  number?: string;
  city: string;
  postalCode: string;
  region?: string;
  country: string;
  type: 'home' | 'work' | 'billing' | 'shipping' | 'other';
  isPrimary: boolean;
  label?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface WebsiteInfo {
  url: string;
  type: 'personal' | 'company' | 'portfolio' | 'blog' | 'other';
  label?: string;
}

export interface SocialMediaInfo {
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'github' | 'other';
  username: string;
  url?: string;
  label?: string;
}

export interface ContactPerson {
  name: string;
  position?: string;
  department?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

export interface ResponsiblePerson extends ContactPerson {
  responsibilities?: string[];
  availableHours?: string;
}

export interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
  exceptions?: string[]; // Για αργίες κλπ
}

export interface DayHours {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  breakStart?: string;
  breakEnd?: string;
}

// Union type για όλες τις επαφές
export type Contact = IndividualContact | CompanyContact | ServiceContact;

// Type guards
export function isIndividualContact(contact: Contact): contact is IndividualContact {
  return contact.type === 'individual';
}

export function isCompanyContact(contact: Contact): contact is CompanyContact {
  return contact.type === 'company';
}

export function isServiceContact(contact: Contact): contact is ServiceContact {
  return contact.type === 'service';
}