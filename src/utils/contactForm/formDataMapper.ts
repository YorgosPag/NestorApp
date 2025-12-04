import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FormDataMappingResult {
  contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
  multiplePhotoURLs: string[];
  photoURL: string;
  logoURL: string;
  warnings: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clean undefined/null/empty values from object
 *
 * ⚠️ ΚΡΙΣΙΜΗ ΣΗΜΕΙΩΣΗ: Αυτή η function ήταν η αιτία του bug με τις φωτογραφίες!
 * ΜΗ ΑΛΛΑΞΕΙΣ την συμπεριφορά του multiplePhotoURLs - παίζουμε πάνω από 1 ημέρα!
 *
 * @param obj - Object to clean
 * @returns Cleaned object
 */
export function cleanUndefinedValues(obj: any): any {
  const cleaned: any = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        // 🚨 CRITICAL FIX - ΜΗ ΑΓΓΙΖΕΙΣ ΑΥΤΟΝ ΤΟΝ ΚΩΔΙΚΑ! 🚨
        // ΠΡΟΒΛΗΜΑ: Πριν από αυτή τη διόρθωση, τα κενά arrays δεν έφταναν στη βάση
        // ΛΥΣΗ: Preserve empty arrays για multiplePhotoURLs ώστε η Firebase να διαγράφει
        // TESTED: 2025-12-04 - Λύθηκε μετά από 5+ ώρες debugging
        // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preserve empty arrays για proper database deletion
        // Ειδικά για multiplePhotoURLs, πρέπει να στέλνουμε [] για διαγραφή
        if (key === 'multiplePhotoURLs' || value.length > 0) {
          cleaned[key] = value;
          if (key === 'multiplePhotoURLs' && value.length === 0) {
            console.log('🛠️ FORM MAPPER: Preserving empty multiplePhotoURLs array for database deletion');
          }
        }
      } else if (typeof value === 'object') {
        const cleanedNestedObj = cleanUndefinedValues(value);
        if (Object.keys(cleanedNestedObj).length > 0) {
          cleaned[key] = cleanedNestedObj;
        }
      } else {
        cleaned[key] = value;
      }
    }
  });

  return cleaned;
}

/**
 * Extract uploaded photo URLs from form data
 * 🔙 HYBRID SYSTEM: Base64 data URLs support
 *
 * @param formData - Contact form data
 * @returns Multiple photo URLs array (Base64 data URLs)
 */
export function extractMultiplePhotoURLs(formData: ContactFormData): string[] {
  const urls: string[] = [];

  formData.multiplePhotos.forEach((photoSlot, index) => {
    // 🆕 ΚΡΙΣΙΜΟ: Ελέγχουμε αν το uploadUrl είναι κενό/διαγραμμένο
    if (photoSlot.uploadUrl && photoSlot.uploadUrl.trim() !== '') {
      // 🔙 HYBRID: Accept both Base64 data URLs and Firebase URLs
      if (photoSlot.uploadUrl.startsWith('data:') || photoSlot.uploadUrl.includes('firebasestorage.googleapis.com')) {
        urls.push(photoSlot.uploadUrl);
        const urlType = photoSlot.uploadUrl.startsWith('data:') ? 'Base64' : 'Firebase';
      } else if (photoSlot.uploadUrl.startsWith('blob:')) {
        // 😫 Απορρίπτουμε blob URLs - είναι temporary!
      }
    }
  });

  return urls;
}

/**
 * 🚨 Enterprise Upload State Validation
 * Validates if all photos have completed upload before form submission
 *
 * @param formData - Contact form data
 * @returns Validation result with pending uploads details
 */
export function validateUploadState(formData: ContactFormData): {
  isValid: boolean;
  pendingUploads: number;
  failedUploads: number;
  totalSlots: number;
  errors: string[];
} {

  const result = {
    isValid: true,
    pendingUploads: 0,
    failedUploads: 0,
    totalSlots: 0,
    errors: [] as string[]
  };

  // Check multiple photos upload state
  formData.multiplePhotos.forEach((photoSlot, index) => {
    // 🔥 CRITICAL FIX: Check for uploads in progress even if file/preview are cleared
    const hasContent = photoSlot.file || photoSlot.preview || photoSlot.uploadUrl || photoSlot.isUploading;

    if (hasContent) {
      result.totalSlots++;

      // 🔙 HYBRID Enhanced check: Consider Base64 URLs as completed uploads
      const hasValidUrl = photoSlot.uploadUrl && (photoSlot.uploadUrl.startsWith('data:') || photoSlot.uploadUrl.includes('firebasestorage.googleapis.com'));
      const isUploadingButNotComplete = photoSlot.isUploading && !hasValidUrl;
      const hasFileButNoUrl = (photoSlot.file || photoSlot.preview) && !hasValidUrl;

      if (isUploadingButNotComplete || hasFileButNoUrl) {
        if (photoSlot.isUploading) {
          result.pendingUploads++;
          result.errors.push(`Φωτογραφία ${index + 1}: Εκκρεμής upload`);
        } else if (photoSlot.error) {
          result.failedUploads++;
          result.errors.push(`Φωτογραφία ${index + 1}: ${photoSlot.error}`);
        } else {
          // File selected but upload never started or stalled
          result.pendingUploads++;
          result.errors.push(`Φωτογραφία ${index + 1}: Upload δεν ξεκίνησε`);
        }
      } else if (hasValidUrl) {
        // 🔙 HYBRID: Photo has valid URL - consider it completed
      }
    }
  });

  // 🔙 HYBRID: Check main photo upload state (for Individual/Service contacts)
  if ((formData.type === 'individual' || formData.type === 'service') && formData.photoFile) {
    const hasValidPhotoUrl = formData.photoPreview && (formData.photoPreview.startsWith('data:') || formData.photoPreview.includes('firebasestorage.googleapis.com'));
    if (!hasValidPhotoUrl) {
      result.pendingUploads++;
      result.errors.push('Κύρια φωτογραφία: Εκκρεμής upload');
    }
  }

  // 🔙 HYBRID: Check logo upload state (for Company/Service contacts)
  // Base64 URLs are considered complete - no need to check further
  if ((formData.type === 'company' || formData.type === 'service') && formData.logoFile) {
    const hasValidLogoUrl = formData.logoPreview && (
      formData.logoPreview.startsWith('data:') ||
      formData.logoPreview.includes('firebasestorage.googleapis.com')
    );
    // Only count as pending if we have a file but NO valid URL (base64 or firebase)
    if (!hasValidLogoUrl) {
      result.pendingUploads++;
      result.errors.push('Logo: Εκκρεμής upload');
    }
  }

  result.isValid = result.pendingUploads === 0 && result.failedUploads === 0;


  return result;
}

/**
 * Extract main photo URL from form data
 * 🔙 HYBRID SYSTEM: Base64 data URLs + multiple photos support
 *
 * @param formData - Contact form data
 * @param contactType - Contact type for logging
 * @returns Photo URL string (Base64 data URL or empty string)
 */
export function extractPhotoURL(formData: ContactFormData, contactType: string): string {

  // 🔙 HYBRID PRIORITY 1: Base64 data URLs from multiplePhotos (για individuals)
  if (formData.multiplePhotos && formData.multiplePhotos.length > 0) {
    const firstPhoto = formData.multiplePhotos[0];
    // 🆕 ΚΡΙΣΙΜΟ: Ελέγχουμε αν είναι κενό
    if (firstPhoto.uploadUrl && firstPhoto.uploadUrl.trim() !== '' && firstPhoto.uploadUrl.startsWith('data:')) {
      return firstPhoto.uploadUrl;
    }
  }

  // 🔙 HYBRID PRIORITY 2: Existing Base64 photoPreview
  if (formData.photoPreview && formData.photoPreview.trim() !== '' && formData.photoPreview.startsWith('data:')) {
    return formData.photoPreview;
  }

  // 🔙 HYBRID PRIORITY 2.5: Check photoURL if photoPreview is empty
  if (formData.photoURL && formData.photoURL.trim() !== '' && formData.photoURL.startsWith('data:')) {
    return formData.photoURL;
  }

  // 🔙 HYBRID PRIORITY 3: Extract Base64 URLs από multiplePhotoURLs
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  if (multiplePhotoURLs.length > 0 && multiplePhotoURLs[0].startsWith('data:')) {
    return multiplePhotoURLs[0];
  }

  // 🔙 HYBRID FALLBACK: Support existing Firebase URLs (from old working contacts)
  if (formData.photoPreview && formData.photoPreview.trim() !== '' && formData.photoPreview.includes('firebasestorage.googleapis.com')) {
    return formData.photoPreview;
  }

  // Also check photoURL for Firebase URLs
  if (formData.photoURL && formData.photoURL.trim() !== '' && formData.photoURL.includes('firebasestorage.googleapis.com')) {
    return formData.photoURL;
  }

  // 🚨 HYBRID RULE: NEVER return blob URLs - they are temporary!
  if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
    return ''; // Κενό string αντί blob URL
  }

  return '';
}

/**
 * Extract logo URL from form data
 *
 * @param formData - Contact form data
 * @param contactType - Contact type for logging
 * @returns Logo URL string
 */
export function extractLogoURL(formData: ContactFormData, contactType: string): string {
  // 🆕 ΚΡΙΣΙΜΟ: First check logoPreview (pending upload) - ΜΕ ΕΛΕΓΧΟ ΚΕΝΟΥ STRING
  if (formData.logoPreview && formData.logoPreview.trim() !== '' && !formData.logoPreview.startsWith('blob:')) {
    return formData.logoPreview;
  }

  // 🆕 ΚΡΙΣΙΜΟ: Then check logoURL (existing logo from database) - ΜΕ ΕΛΕΓΧΟ ΚΕΝΟΥ STRING
  if (formData.logoURL && formData.logoURL.trim() !== '' && !formData.logoURL.startsWith('blob:')) {
    return formData.logoURL;
  }

  return '';
}

/**
 * Create emails array from form email field
 *
 * @param email - Email string from form
 * @returns Emails array
 */
export function createEmailsArray(email: string): any[] {
  return email ? [{ email, type: 'work', isPrimary: true }] : [];
}

/**
 * Create phones array from form phone field
 *
 * @param phone - Phone string from form
 * @param phoneType - Phone type ('mobile' | 'work')
 * @returns Phones array
 */
export function createPhonesArray(phone: string, phoneType: 'mobile' | 'work' = 'mobile'): any[] {
  return phone ? [{ number: phone, type: phoneType, isPrimary: true }] : [];
}

// ============================================================================
// MAIN MAPPING FUNCTIONS
// ============================================================================

/**
 * Map Individual Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Individual contact data
 */
export function mapIndividualFormData(formData: ContactFormData): any {
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  const photoURL = extractPhotoURL(formData, 'individual');


  return {
    type: 'individual',
    firstName: formData.firstName,
    lastName: formData.lastName,
    fatherName: formData.fatherName,
    motherName: formData.motherName,
    birthDate: formData.birthDate,
    birthCountry: formData.birthCountry,
    gender: formData.gender,
    amka: formData.amka,
    documentType: formData.documentType,
    documentIssuer: formData.documentIssuer,
    documentNumber: formData.documentNumber,
    documentIssueDate: formData.documentIssueDate,
    documentExpiryDate: formData.documentExpiryDate,
    vatNumber: formData.vatNumber,
    taxOffice: formData.taxOffice,
    profession: formData.profession,
    specialty: formData.specialty,
    employer: formData.employer,
    position: formData.position,
    workAddress: formData.workAddress,
    workWebsite: formData.workWebsite,
    socialMedia: formData.socialMedia,
    websites: formData.websites,
    photoURL,
    multiplePhotoURLs, // 📸 Multiple photos array
    emails: createEmailsArray(formData.email),
    phones: createPhonesArray(formData.phone, 'mobile'),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,

    // 🔥 NEW: Additional Contact Information
    address: formData.address,
    city: formData.city,
    postalCode: formData.postalCode,
    email: formData.email, // Add raw email for compatibility
    phone: formData.phone, // Add raw phone for compatibility
  };
}

/**
 * Map Company Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Company contact data
 */
export function mapCompanyFormData(formData: ContactFormData): any {
  const logoURL = extractLogoURL(formData, 'company');
  const photoURL = extractPhotoURL(formData, 'company representative'); // 🔧 FIX: Εξαγωγή φωτογραφίας εκπροσώπου
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData); // 📸 Multiple photos για companies



  // Removed old return statement - using the consolidated one below

  // 🔍 DEBUG: Final mapped object
  const result = {
    type: 'company',
    companyName: formData.companyName,
    vatNumber: formData.vatNumber, // 🔧 FIX: Use correct field name
    logoURL,
    photoURL,
    multiplePhotoURLs,
    emails: createEmailsArray(formData.email),
    phones: createPhonesArray(formData.phone, 'work'),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
    registrationNumber: formData.gemiNumber,
    gemiNumber: formData.gemiNumber,
    tradeName: formData.tradeName,
    legalForm: formData.legalForm,
    address: formData.address,
    city: formData.city,
    postalCode: formData.postalCode,
    website: formData.website,
    customFields: {
      gemiStatus: formData.gemiStatus,
      gemiStatusDate: formData.gemiStatusDate,
      activityCodeKAD: formData.activityCodeKAD,
      activityDescription: formData.activityDescription,
      activityType: formData.activityType,
      chamber: formData.chamber,
      capitalAmount: formData.capitalAmount,
      currency: formData.currency,
      extraordinaryCapital: formData.extraordinaryCapital,
      registrationDate: formData.registrationDate,
      lastUpdateDate: formData.lastUpdateDate,
      gemiDepartment: formData.gemiDepartment,
      prefecture: formData.prefecture,
      municipality: formData.municipality,
    }
  };


  return result;
}

/**
 * Map Service Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Service contact data
 */
export function mapServiceFormData(formData: ContactFormData): any {
  const logoURL = extractLogoURL(formData, 'service');
  const photoURL = extractPhotoURL(formData, 'service representative');
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData); // 📸 Multiple photos για services

  // 🔧 FIX: Support both serviceName (old) and name (service-config) fields
  const serviceName = formData.serviceName || formData.name || '';


  return {
    type: 'service',
    serviceName,
    serviceType: formData.serviceType,
    // Βασικά Στοιχεία Δημόσιας Υπηρεσίας (Service Config)
    shortName: formData.shortName,
    category: formData.category,
    supervisionMinistry: formData.supervisionMinistry,
    // Διοικητικά Στοιχεία (Service Config)
    legalStatus: formData.legalStatus,
    establishmentLaw: formData.establishmentLaw,
    headTitle: formData.headTitle,
    headName: formData.headName,
    logoURL, // 🏛️ Enterprise service logo URL
    photoURL, // 🏛️ Enterprise service representative photo URL
    multiplePhotoURLs, // 📸 Multiple photos array για service photos

    // Επικοινωνία Υπηρεσίας (Contact Section)
    address: formData.address,
    postalCode: formData.postalCode,
    city: formData.city,
    fax: formData.fax,
    website: formData.website,

    // Υπηρεσίες Φορέα (Services Section)
    mainResponsibilities: formData.mainResponsibilities,
    citizenServices: formData.citizenServices,
    onlineServices: formData.onlineServices,
    serviceHours: formData.serviceHours,

    emails: createEmailsArray(formData.email),
    phones: createPhonesArray(formData.phone, 'work'),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
  };
}

/**
 * Map ContactFormData to Contact object (main function)
 *
 * Enterprise-class mapping από form data στο Contact model.
 * Επιλέγει το σωστό mapper βάσει contact type.
 *
 * @param formData - Contact form data
 * @returns FormDataMappingResult with contact data and extracted URLs
 */
export function mapFormDataToContact(formData: ContactFormData): FormDataMappingResult {

  const warnings: string[] = [];
  let contactData: any;
  let photoURL = '';
  let logoURL = '';
  let multiplePhotoURLs: string[] = [];

  try {
    switch (formData.type) {
      case 'individual':
        contactData = mapIndividualFormData(formData);
        photoURL = contactData.photoURL;
        multiplePhotoURLs = contactData.multiplePhotoURLs;
        break;

      case 'company':
        contactData = mapCompanyFormData(formData);
        logoURL = contactData.logoURL;
        photoURL = contactData.photoURL; // 🔧 FIX: Προσθήκη φωτογραφίας εκπροσώπου για εταιρείες
        multiplePhotoURLs = contactData.multiplePhotoURLs; // 🔧 FIX: Προσθήκη multiple photos για εταιρείες
        break;

      case 'service':
        contactData = mapServiceFormData(formData);
        logoURL = contactData.logoURL;
        photoURL = contactData.photoURL;
        multiplePhotoURLs = contactData.multiplePhotoURLs; // 🔧 FIX: Προσθήκη multiple photos για υπηρεσίες
        break;

      default:
        throw new Error(`Unknown contact type: ${formData.type}`);
    }

    // Clean undefined values
    const cleanedData = cleanUndefinedValues(contactData);


    return {
      contactData: cleanedData,
      multiplePhotoURLs,
      photoURL,
      logoURL,
      warnings
    };

  } catch (error) {

    return {
      contactData: {} as any,
      multiplePhotoURLs: [],
      photoURL: '',
      logoURL: '',
      warnings: [`Mapping failed: ${error}`]
    };
  }
}