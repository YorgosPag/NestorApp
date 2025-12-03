import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue, getSafeArrayValue } from '../contactMapper';

// ============================================================================
// INDIVIDUAL CONTACT MAPPER
// ============================================================================

/**
 * Map Individual Contact to ContactFormData
 *
 * Specialized mapper για φυσικά πρόσωπα (individuals).
 * Χειρίζεται όλα τα individual-specific fields με type safety.
 *
 * @param contact - Individual contact object
 * @returns ContactFormData for individual
 */
export function mapIndividualContactToFormData(contact: Contact): ContactFormData {

  const individualContact = contact as any; // Cast for individual fields access

  // 📸 MULTIPLE PHOTOS: Convert Firebase URLs to PhotoSlots για edit mode
  const multiplePhotoURLs = getSafeArrayValue(individualContact, 'multiplePhotoURLs');

  const multiplePhotos = multiplePhotoURLs
    .filter((url: string) => url && !url.startsWith('blob:')) // Φίλτρα blob URLs
    .map((url: string) => {
      const urlType = url.startsWith('data:') ? 'Base64' : 'Firebase';
      return {
        uploadUrl: url, // Base64 ή Firebase URL για display
        preview: url,   // Base64 ή Firebase URL για preview
        file: null,     // Κανένα αρχείο σε edit mode
        isUploading: false
      };
    });


  const formData: ContactFormData = {
    // Basic info
    type: 'individual',

    // 👤 Βασικά Στοιχεία Φυσικού Προσώπου
    firstName: getSafeFieldValue(individualContact, 'firstName'),
    lastName: getSafeFieldValue(individualContact, 'lastName'),
    fatherName: getSafeFieldValue(individualContact, 'fatherName'),
    motherName: getSafeFieldValue(individualContact, 'motherName'),
    birthDate: getSafeFieldValue(individualContact, 'birthDate'),
    birthCountry: getSafeFieldValue(individualContact, 'birthCountry'),
    gender: getSafeFieldValue(individualContact, 'gender'),
    amka: getSafeFieldValue(individualContact, 'amka'),

    // 💳 Ταυτότητα & ΑΦΜ
    documentType: getSafeFieldValue(individualContact, 'documentType'),
    documentIssuer: getSafeFieldValue(individualContact, 'documentIssuer'),
    documentNumber: getSafeFieldValue(individualContact, 'documentNumber'),
    documentIssueDate: getSafeFieldValue(individualContact, 'documentIssueDate'),
    documentExpiryDate: getSafeFieldValue(individualContact, 'documentExpiryDate'),
    vatNumber: getSafeFieldValue(individualContact, 'vatNumber'),
    taxOffice: getSafeFieldValue(individualContact, 'taxOffice'),

    // 💼 Επαγγελματικά Στοιχεία
    profession: getSafeFieldValue(individualContact, 'profession'),
    specialty: getSafeFieldValue(individualContact, 'specialty'),
    employer: getSafeFieldValue(individualContact, 'employer'),
    position: getSafeFieldValue(individualContact, 'position'),
    workAddress: getSafeFieldValue(individualContact, 'workAddress'),
    workWebsite: getSafeFieldValue(individualContact, 'workWebsite'),

    // 📞 Επικοινωνία
    email: contact.emails?.[0]?.email || '',
    phone: contact.phones?.[0]?.number || '',

    // 🌐 Social Media
    socialMedia: {
      facebook: getSafeFieldValue(individualContact.socialMedia, 'facebook'),
      instagram: getSafeFieldValue(individualContact.socialMedia, 'instagram'),
      linkedin: getSafeFieldValue(individualContact.socialMedia, 'linkedin'),
      twitter: getSafeFieldValue(individualContact.socialMedia, 'twitter'),
    },
    websites: getSafeFieldValue(individualContact, 'websites'),

    // 📷 Φωτογραφίες
    photoFile: null,
    photoPreview: getSafeFieldValue(individualContact, 'photoURL'),
    multiplePhotos, // 📸 Multiple photos array

    // 📝 Notes
    notes: getSafeFieldValue(contact, 'notes'),

    // Company fields (empty for individual)
    companyName: '',
    companyVatNumber: '',
    logoFile: null,
    logoPreview: '',

    // Service fields (empty for individual)
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


  return formData;
}