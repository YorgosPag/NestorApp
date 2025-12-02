import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue, getSafeArrayValue, getSafeNestedValue } from '../contactMapper';

// ============================================================================
// SERVICE CONTACT MAPPER
// ============================================================================

/**
 * Map Service Contact to ContactFormData
 *
 * Specialized mapper για δημόσιες υπηρεσίες (services).
 * Χειρίζεται όλα τα service-specific fields με type safety.
 *
 * @param contact - Service contact object
 * @returns ContactFormData for service
 */
export function mapServiceContactToFormData(contact: Contact): ContactFormData {
  console.log('🔄 SERVICE MAPPER: Starting service contact mapping');

  const serviceContact = contact as any; // Cast for service fields access

  const formData: ContactFormData = {
    // Basic info
    type: 'service',

    // 🏛️ Service Στοιχεία
    serviceName: getSafeFieldValue(serviceContact, 'serviceName'),
    serviceType: getSafeFieldValue(serviceContact, 'serviceType', 'other'),

    // 📞 Επικοινωνία
    email: contact.emails?.[0]?.email || '',
    phone: contact.phones?.[0]?.number || '',

    // 📷 Photos & Logo
    photoFile: null,
    photoPreview: getSafeFieldValue(serviceContact, 'photoURL'),
    logoFile: null,
    logoPreview: getSafeFieldValue(serviceContact, 'logoURL'),

    // 🏛️ ΓΕΜΗ Στοιχεία (από ΓΕΜΗ API data)
    gemiNumber: getSafeFieldValue(serviceContact, 'gemiNumber'),
    serviceVatNumber: getSafeFieldValue(serviceContact, 'serviceVatNumber'),
    serviceTaxOffice: getSafeFieldValue(serviceContact, 'serviceTaxOffice'),
    serviceTitle: getSafeFieldValue(serviceContact, 'serviceTitle'),
    tradeName: getSafeFieldValue(serviceContact, 'tradeName'),
    legalForm: getSafeFieldValue(serviceContact, 'legalForm'),
    gemiStatus: getSafeFieldValue(serviceContact, 'gemiStatus'),
    gemiStatusDate: getSafeFieldValue(serviceContact, 'gemiStatusDate'),
    chamber: getSafeFieldValue(serviceContact, 'chamber'),
    isBranch: getSafeFieldValue(serviceContact, 'isBranch', false),
    registrationMethod: getSafeFieldValue(serviceContact, 'registrationMethod'),

    // Πρόσθετα ΓΕΜΗ στοιχεία
    registrationDate: getSafeFieldValue(serviceContact, 'registrationDate'),
    lastUpdateDate: getSafeFieldValue(serviceContact, 'lastUpdateDate'),
    gemiDepartment: getSafeFieldValue(serviceContact, 'gemiDepartment'),
    prefecture: getSafeFieldValue(serviceContact, 'prefecture'),
    municipality: getSafeFieldValue(serviceContact, 'municipality'),
    activityCodeKAD: getSafeFieldValue(serviceContact, 'activityCodeKAD'),
    activityDescription: getSafeFieldValue(serviceContact, 'activityDescription'),
    activityType: getSafeFieldValue(serviceContact, 'activityType', 'main'),
    activityValidFrom: getSafeFieldValue(serviceContact, 'activityValidFrom'),
    activityValidTo: getSafeFieldValue(serviceContact, 'activityValidTo'),

    // Κεφάλαιο
    capitalAmount: getSafeFieldValue(serviceContact, 'capitalAmount'),
    currency: getSafeFieldValue(serviceContact, 'currency'),
    extraordinaryCapital: getSafeFieldValue(serviceContact, 'extraordinaryCapital'),

    // Στοιχεία Φορέα
    serviceCode: getSafeFieldValue(serviceContact, 'serviceCode'),
    parentMinistry: getSafeFieldValue(serviceContact, 'parentMinistry'),
    serviceCategory: getSafeFieldValue(serviceContact, 'serviceCategory'),
    officialWebsite: getSafeFieldValue(serviceContact, 'officialWebsite'),

    // Διεύθυνση Έδρας
    serviceAddress: {
      street: getSafeNestedValue(serviceContact, 'serviceAddress.street'),
      number: getSafeNestedValue(serviceContact, 'serviceAddress.number'),
      postalCode: getSafeNestedValue(serviceContact, 'serviceAddress.postalCode'),
      city: getSafeNestedValue(serviceContact, 'serviceAddress.city')
    },

    // Arrays (ΓΕΜΗ data)
    representatives: getSafeArrayValue(serviceContact, 'representatives'),
    shareholders: getSafeArrayValue(serviceContact, 'shareholders'),
    branches: getSafeArrayValue(serviceContact, 'branches'),
    documents: getSafeFieldValue(serviceContact, 'documents', {
      announcementDocs: [],
      registrationDocs: []
    }),
    decisions: getSafeArrayValue(serviceContact, 'decisions'),
    announcements: getSafeArrayValue(serviceContact, 'announcements'),

    // 📝 Notes
    notes: getSafeFieldValue(contact, 'notes'),

    // Individual fields (empty for service)
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
    multiplePhotos: [],

    // Company fields (empty for service)
    companyName: '',
    companyVatNumber: ''
  };

  console.log('✅ SERVICE MAPPER: Service contact mapping completed');
  return formData;
}