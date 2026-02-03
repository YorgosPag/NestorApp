import type { Contact, CompanyContact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue } from '../contactMapper';

/** Extended company contact with custom fields access */
interface ExtendedCompanyContact extends CompanyContact {
  customFields?: Record<string, unknown>;
}

/**
 * Get value from contact object or customFields
 * Tries root level first, then customFields
 */
function getContactValue(contact: ExtendedCompanyContact, fieldName: string): string {
  // Try root level first
  const rootValue = getSafeFieldValue<string>(contact, fieldName, '');
  if (rootValue) return rootValue;

  // Try customFields
  const customValue = contact.customFields?.[fieldName];
  return typeof customValue === 'string' ? customValue : '';
}

// ============================================================================
// COMPANY CONTACT MAPPER
// ============================================================================

/**
 * Map Company Contact to ContactFormData
 *
 * Specialized mapper για εταιρείες (companies).
 * Χειρίζεται όλα τα company-specific fields με type safety.
 *
 * @param contact - Company contact object
 * @returns ContactFormData for company
 */
export function mapCompanyContactToFormData(contact: Contact): ContactFormData {
  // Type-safe cast for company fields access
  const companyContact = contact as ExtendedCompanyContact;


  const formData: ContactFormData = {
    // Basic info
    type: 'company',
    id: contact.id, // 🔥 CRITICAL FIX: Include contact ID for relationship management

    // 🏢 Company Στοιχεία
    companyName: getSafeFieldValue(companyContact, 'companyName'),
    vatNumber: getSafeFieldValue(companyContact, 'vatNumber'), // 🔧 FIX: Use correct field name
    companyVatNumber: getSafeFieldValue(companyContact, 'vatNumber') ||
                     getSafeFieldValue(companyContact, 'companyVatNumber'), // Legacy compatibility

    // 📞 Επικοινωνία - ENTERPRISE Arrays Structure
    street: contact.addresses?.[0]?.street || '',
    streetNumber: contact.addresses?.[0]?.number || '',
    city: contact.addresses?.[0]?.city || '',
    postalCode: contact.addresses?.[0]?.postalCode || '',
    phone: contact.phones?.[0]?.number || '',
    email: contact.emails?.[0]?.email || '',
    website: contact.websites?.[0]?.url || '',

    // 🏢 Logo
    logoFile: null,
    logoPreview: getSafeFieldValue(companyContact, 'logoURL'),
    logoURL: getSafeFieldValue(companyContact, 'logoURL'), // Added for tab display consistency

    // 📝 Notes
    notes: getSafeFieldValue(contact, 'notes'),

    // Individual fields (empty for company)
    firstName: '',
    lastName: '',
    fatherName: '',
    motherName: '',
    birthDate: '',
    birthCountry: '',
    gender: '',
    amka: '',
    documentType: '',
    documentIssuer: '',
    documentNumber: '',
    documentIssueDate: '',
    documentExpiryDate: '',
    // vatNumber: '', // 🔧 FIX: Removed - this was overriding the company vatNumber above!
    taxOffice: '',
    profession: '',
    specialty: '',
    employer: '',
    position: '',
    workAddress: '',
    workWebsite: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      linkedin: '',
      twitter: ''
    },
    websites: contact.websites ?? [],
    photoFile: null,
    photoPreview: getSafeFieldValue(companyContact, 'photoURL'), // 🔧 FIX: Get representative photo from contact
    photoURL: getSafeFieldValue(companyContact, 'photoURL'), // Added for tab display
    multiplePhotos: [],

    // Service fields (empty for company)
    serviceName: '',
    serviceType: 'other',

    // 🔧 ΓΕΜΗ Fields (get from root or customFields)
    gemiNumber: getContactValue(companyContact, 'gemiNumber') || getContactValue(companyContact, 'registrationNumber'),
    serviceVatNumber: '',
    serviceTaxOffice: '',
    serviceTitle: '',
    tradeName: getContactValue(companyContact, 'tradeName'),
    legalForm: getContactValue(companyContact, 'legalForm'),
    gemiStatus: getContactValue(companyContact, 'gemiStatus'),
    gemiStatusDate: getContactValue(companyContact, 'gemiStatusDate'),
    chamber: getContactValue(companyContact, 'chamber'),
    isBranch: false,
    registrationMethod: '',
    registrationDate: '',
    lastUpdateDate: '',
    gemiDepartment: '',
    prefecture: '',
    municipality: '',
    activityCodeKAD: getContactValue(companyContact, 'activityCodeKAD'),
    activityDescription: getContactValue(companyContact, 'activityDescription'),
    activityType: getContactValue(companyContact, 'activityType') as 'main' | 'secondary' || 'main',
    activityValidFrom: getContactValue(companyContact, 'activityValidFrom'),
    activityValidTo: getContactValue(companyContact, 'activityValidTo'),
    capitalAmount: getContactValue(companyContact, 'capitalAmount'),
    currency: getContactValue(companyContact, 'currency'),
    extraordinaryCapital: getContactValue(companyContact, 'extraordinaryCapital'),
    serviceCode: '',
    parentMinistry: '',
    serviceCategory: '',
    officialWebsite: '',
    serviceAddress: {
      street: '',
      number: '',
      postalCode: '',
      city: ''
    },
    representatives: [],
    shareholders: [],
    branches: [],
    documents: {
      announcementDocs: [],
      registrationDocs: []
    },
    decisions: [],
    announcements: []
  };


  return formData;
}
