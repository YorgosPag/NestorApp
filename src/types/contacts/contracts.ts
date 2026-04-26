// Type definitions for contacts, decoupled from Firebase SDK.

export type FirestoreishTimestamp = Date | { toDate: () => Date };

// Βασικοί τύποι επαφών
export type ContactType = 'individual' | 'company' | 'service';
export type ContactStatus = 'active' | 'inactive' | 'archived' | 'deleted';

// Βασικό interface για όλες τις επαφές
export interface BaseContact {
  id?: string;
  type: ContactType;
  isFavorite: boolean;
  status: ContactStatus;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;

  // 🗑️ Soft-delete lifecycle fields (ADR-191 pattern)
  /** Timestamp when the contact was soft-deleted (moved to trash) */
  deletedAt?: FirestoreishTimestamp;
  /** UID of the user who soft-deleted this contact */
  deletedBy?: string;
  /** Status before deletion — used by restore to return to correct state */
  previousStatus?: ContactStatus;

  createdAt: FirestoreishTimestamp;
  updatedAt: FirestoreishTimestamp;
  createdBy?: string;
  lastModifiedBy?: string;

  // 🏢 ENTERPRISE TENANT ISOLATION (ADR-029: Global Search v1)
  // Required for multi-tenant security and search indexing
  // Derived from createdBy user's companyId during creation
  // @see firestore.rules - contacts collection tenant-scoped reads
  /**
   * Company/Tenant ID for multi-tenant isolation.
   * Set automatically from creator's companyId during contact creation.
   * Required for: Firestore security rules, Global Search indexing
   */
  companyId?: string;
  // 🏢 ENTERPRISE: Common display properties for all contact types (2026-01-19)
  /** Computed display name - for UI consistency across contact types */
  name?: string;
  /** Display name alias (used in some API responses) */
  displayName?: string;
  /** First name (individuals) or primary contact name (companies/services) */
  firstName?: string;
  /** Last name (individuals) */
  lastName?: string;
  /** Company name (for company contacts) */
  companyName?: string;
  /** Service name (for service contacts) */
  serviceName?: string;
  // 🏢 ENTERPRISE: Photo/Logo URL properties for useContactSubmission (2026-01-19)
  /** Profile photo URL (for individuals) */
  photoURL?: string;
  /** Multiple photo URLs */
  multiplePhotoURLs?: string[];
  /** Logo URL (for companies/services) */
  logoURL?: string;

  // 🔍 ENTERPRISE: Denormalized persona types for Firestore querying (ADR-268 Q88)
  // Auto-synced from personas[].personaType when contact is saved.
  // SSoT: lives on BaseContact so all contact variants expose it for queries.
  personaTypes?: string[];

  // 🏢 ENTERPRISE: Extended display properties (2026-01-20)
  /** Trade name / Commercial name (for companies) */
  tradeName?: string;
  /** Legal name (full official name for companies) */
  legalName?: string;
  /** Multiple photos array (for gallery-style display) */
  multiplePhotos?: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
    caption?: string;
    isProfile?: boolean;
  }>;
  /** Social media accounts array (for DynamicContactArrays compatibility) */
  socialMediaArray?: Array<{
    platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'github' | 'other';
    username: string;
    url?: string;
    label?: string;
  }>;
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
  profession?: string;        // Επάγγελμα (human-readable, always set)
  specialty?: string;         // Ειδικότητα
  employer?: string;          // Επιχείρηση/Εργοδότης
  employerId?: string;        // ID σύνδεσης με Company contact (ADR-177)
  position?: string;          // Θέση/Ρόλος
  workAddress?: string;       // Διεύθυνση Εργασίας
  workWebsite?: string;       // Ιστοσελίδα Επαγγελματικού Προφίλ

  // 🇪🇺 ESCO Professional Classification (ADR-034)
  // European standard occupation taxonomy — optional, backward compatible
  escoUri?: string;           // ESCO occupation URI (link to EU taxonomy)
  escoLabel?: string;         // Cached ESCO preferred label
  iscoCode?: string;          // ISCO-08 4-digit code (for grouping/filtering)

  // 🇪🇺 ESCO Skills (ADR-132)
  // Multi-select skills from EU ESCO taxonomy — optional, backward compatible
  escoSkills?: Array<{
    uri: string;     // ESCO skill URI (empty string for free-text skills)
    label: string;   // Cached skill label
  }>;

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

  // 🎭 ENTERPRISE: Contact Persona System (ADR-121)
  // SAP Business Partner pattern: role-based dynamic fields
  // Each persona activates conditional sections with role-specific fields
  personas?: import('./personas').PersonaData[];
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

  // 🏢 ENTERPRISE: Representative photo for company (2026-01-20)
  /** Representative photo URL for company primary contact */
  representativePhotoURL?: string;

  /**
   * ADR-326 Phase 5 — Embedded org chart for L2 CompanyContact.
   * Optional: tenants opt in per-supplier/customer.
   * `userId` on members MUST be null at L2 (server enforces, G8).
   */
  orgStructure?: import('@/types/org/org-structure').OrgStructure | null;
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
  /** Extended with org-routing literals (ADR-326 Phase 4) */
  type: 'personal' | 'work' | 'invoice' | 'notification' | 'support' | 'other';
  isPrimary: boolean;
  label?: string;
}

export interface PhoneInfo {
  number: string;
  /** Extended with 'internal' for PBX extensions (ADR-326 Phase 4) */
  type: 'mobile' | 'home' | 'work' | 'fax' | 'internal' | 'other';
  isPrimary: boolean;
  label?: string;
  countryCode?: string;
  // Εσωτερικό / extension (PBX internal number). Optional free text.
  extension?: string;
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
  // Administrative Hierarchy fields
  municipality?: string;
  municipalityId?: string | null;
  regionalUnit?: string;
  decentAdmin?: string;
  majorGeo?: string;
  settlement?: string;
  settlementId?: string | null;
  community?: string;
  municipalUnit?: string;
}

export interface WebsiteInfo {
  url: string;
  type: 'personal' | 'company' | 'portfolio' | 'blog' | 'other';
  label?: string;
}

export interface SocialMediaInfo {
  platform:
    | 'facebook'
    | 'twitter'
    | 'linkedin'
    | 'instagram'
    | 'youtube'
    | 'github'
    | 'tiktok'
    | 'whatsapp'
    | 'telegram'
    | 'other';
  username: string;
  url?: string;
  type?: 'personal' | 'professional' | 'business' | 'official' | 'informational' | 'corporate' | 'marketing' | 'other';
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
  /** L3 comms upgrade (ADR-326 Phase 4): replaces inherited single-string email/phone */
  emails: EmailInfo[];
  phones: PhoneInfo[];
}

/**
 * Backward-compat mapper: wraps legacy single-string email/phone fields
 * (from pre-Phase-4 Firestore docs) into the new EmailInfo[]/PhoneInfo[] arrays.
 */
export function normalizeResponsiblePersonComms(
  raw: Omit<ResponsiblePerson, 'emails' | 'phones'> & {
    emails?: EmailInfo[];
    phones?: PhoneInfo[];
    email?: string;
    phone?: string;
  }
): ResponsiblePerson {
  const emails: EmailInfo[] =
    raw.emails && raw.emails.length > 0
      ? raw.emails
      : raw.email
      ? [{ email: raw.email, type: 'work', isPrimary: true }]
      : [];
  const phones: PhoneInfo[] =
    raw.phones && raw.phones.length > 0
      ? raw.phones
      : raw.phone
      ? [{ number: raw.phone, type: 'work', isPrimary: true }]
      : [];
  return { ...raw, emails, phones } as ResponsiblePerson;
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