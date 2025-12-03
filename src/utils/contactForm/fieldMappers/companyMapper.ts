import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue } from '../contactMapper';

/**
 * Get value from contact object or customFields
 * Tries root level first, then customFields
 */
function getContactValue(contact: any, fieldName: string): string {
  // Try root level first
  const rootValue = getSafeFieldValue(contact, fieldName);
  if (rootValue) return rootValue;

  // Try customFields
  const customValue = contact.customFields?.[fieldName];
  return customValue || '';
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
  console.log('🔄 COMPANY MAPPER: Starting company contact mapping');

  const companyContact = contact as any; // Cast for company fields access

  // 🔍 DEBUG: Log what we're mapping from
  console.log('🔍 COMPANY MAPPER DEBUG:', {
    contactVatNumber: companyContact.vatNumber,
    contactCustomFields: companyContact.customFields,
    contactRegistrationNumber: companyContact.registrationNumber,
    contactGemiNumber: companyContact.gemiNumber
  });

  const formData: ContactFormData = {
    // Basic info
    type: 'company',

    // 🏢 Company Στοιχεία
    companyName: getSafeFieldValue(companyContact, 'companyName'),
    vatNumber: getSafeFieldValue(companyContact, 'vatNumber'), // 🔧 FIX: Use correct field name
    companyVatNumber: getSafeFieldValue(companyContact, 'vatNumber') ||
                     getSafeFieldValue(companyContact, 'companyVatNumber'), // Legacy compatibility

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
    websites: '',
    photoFile: null,
    photoPreview: '',
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

  // 🔍 DEBUG: Log final formData before returning (για ΑΦΜ troubleshooting)
  console.log('🔍 COMPANY MAPPER FINAL RESULT:', {
    'formData.vatNumber': formData.vatNumber,
    'formData.companyVatNumber': formData.companyVatNumber,
    'formData.gemiNumber': formData.gemiNumber,
    'formData.gemiStatus': formData.gemiStatus,
    'formData.tradeName': formData.tradeName,
    fullFormDataVatFields: {
      vatNumber: formData.vatNumber,
      companyVatNumber: formData.companyVatNumber
    }
  });

  console.log('✅ COMPANY MAPPER: Company contact mapping completed');
  return formData;
}