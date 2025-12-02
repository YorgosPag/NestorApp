import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue } from '../contactMapper';

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
  console.log('🔄 COMPANY MAPPER: Starting company contact mapping');

  const companyContact = contact as any; // Cast for company fields access

  const formData: ContactFormData = {
    // Basic info
    type: 'company',

    // 🏢 Company Στοιχεία
    companyName: getSafeFieldValue(companyContact, 'companyName'),
    companyVatNumber: getSafeFieldValue(companyContact, 'vatNumber') ||
                     getSafeFieldValue(companyContact, 'companyVatNumber'),

    // 📞 Επικοινωνία
    email: contact.emails?.[0]?.email || '',
    phone: contact.phones?.[0]?.number || '',

    // 🏢 Logo
    logoFile: null,
    logoPreview: getSafeFieldValue(companyContact, 'logoURL'),

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
    vatNumber: '',
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
    websites: '',
    photoFile: null,
    photoPreview: '',
    multiplePhotos: [],

    // Service fields (empty for company)
    serviceName: '',
    serviceType: 'other',
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
    capitalAmount: '',
    currency: '',
    extraordinaryCapital: '',
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

  console.log('✅ COMPANY MAPPER: Company contact mapping completed');
  return formData;
}