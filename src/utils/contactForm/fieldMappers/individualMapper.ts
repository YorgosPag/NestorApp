import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
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

  console.log('🔍 INDIVIDUAL MAPPER: Starting mapping for contact', contact.id);

  const individualContact = contact as any; // Cast for individual fields access

  // 📸 MULTIPLE PHOTOS - ENTERPRISE SOLUTION (2025 STANDARD)
  const rawUrls = getSafeArrayValue(individualContact, 'multiplePhotoURLs') || [];

  console.log('🔍 INDIVIDUAL MAPPER: rawUrls from database:', rawUrls);

  // 🚨 CRITICAL FIX - ΜΗ ΑΛΛΑΞΕΙΣ ΑΥΤΗ ΤΗ ΛΟΓΙΚΗ! 🚨
  // BUG HISTORY: Πριν από αυτή τη διόρθωση, το filtering αφαίρεσε κενά arrays
  // ΠΡΟΒΛΗΜΑ: Τα κενά arrays δεν έφταναν ποτέ στη βάση δεδομένων
  // ΛΥΣΗ: Explicit handling για empty arrays ώστε να διαγράφονται οι φωτογραφίες
  // TESTED: 2025-12-04 - Επιτυχής διόρθωση μετά από 5+ ώρες debugging
  // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preserve empty arrays for proper database deletion
  let multiplePhotos: PhotoSlot[] = [];

  if (rawUrls.length === 0) {
    // ✅ ΚΕΝΟ ARRAY: Κρατάμε κενό για proper deletion στη βάση
    multiplePhotos = [];
    console.log('🛠️ INDIVIDUAL MAPPER: Empty photos array - will delete from database');
    console.log('🛠️ INDIVIDUAL MAPPER: Also clearing photoURL field for complete deletion');
  } else {
    // ✅ ΥΠΑΡΧΟΥΝ ΦΩΤΟΓΡΑΦΙΕΣ: Normal processing
    multiplePhotos = rawUrls
      // Βήμα 1: Κρατάμε ΜΟΝΟ strings
      .filter((url): url is string => typeof url === 'string')
      // Βήμα 2: Αφαιρούμε blob URLs και invalid formats (αλλά ΟΧΙ κενά strings)
      .filter(url => {
        const trimmed = url.trim();
        return trimmed !== '' &&
               !trimmed.startsWith('blob:') &&
               (trimmed.startsWith('data:') || trimmed.startsWith('https://'));
      })
      // Βήμα 3: Μετατρέπουμε σε PhotoSlot με απόλυτη ασφάλεια
      .map(url => ({
        preview: url.trim(),
        uploadUrl: url.trim(),
        isUploading: false,
        error: null,
        file: null
      }));
  }


  const formData: ContactFormData = {
    // Basic info
    type: 'individual',
    id: contact.id, // 🔥 CRITICAL FIX: Include contact ID for relationship management

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

    // 📞 Επικοινωνία - ENTERPRISE Arrays Structure
    street: contact.addresses?.[0]?.street || '',
    streetNumber: contact.addresses?.[0]?.number || '',
    city: contact.addresses?.[0]?.city || '',
    postalCode: contact.addresses?.[0]?.postalCode || '',

    // 🚀 DYNAMIC ARRAYS: Pass full arrays for dynamic management
    phones: contact.phones || [],
    emails: contact.emails || [],
    websites: contact.websites || [],
    socialMediaArray: contact.socialMedia || [],

    // Legacy fields for backward compatibility
    phone: contact.phones?.[0]?.number || '',
    email: contact.emails?.[0]?.email || '',
    website: contact.websites?.[0]?.url || '',

    // 🌐 Social Media
    socialMedia: {
      facebook: getSafeFieldValue(individualContact.socialMedia, 'facebook'),
      instagram: getSafeFieldValue(individualContact.socialMedia, 'instagram'),
      linkedin: getSafeFieldValue(individualContact.socialMedia, 'linkedin'),
      twitter: getSafeFieldValue(individualContact.socialMedia, 'twitter'),
    },

    // 📷 Φωτογραφίες
    photoFile: null,
    // 🔥 CRITICAL FIX: Clear photoURL όταν δεν υπάρχουν φωτογραφίες
    photoPreview: multiplePhotos.length === 0 ? '' : getSafeFieldValue(individualContact, 'photoURL'),
    multiplePhotos: multiplePhotos.length > 0 ? multiplePhotos : [], // 📸 Multiple photos array

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