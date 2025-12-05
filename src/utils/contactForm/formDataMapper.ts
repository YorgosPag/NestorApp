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
 * 🏢 ENTERPRISE: Detect if URL is Firebase Storage URL
 */
function isFirebaseStorageURL(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  return url.includes('firebasestorage.googleapis.com') || url.includes('appspot.com');
}

/**
 * 🏢 ENTERPRISE: Detect if URL requires special deletion handling
 */
function requiresSpecialDeletion(key: string, value: any): boolean {
  // Always preserve photoURL fields (Base64 or Firebase Storage)
  if (key === 'photoURL') return true;

  // 🏢 ENTERPRISE FIX: Always preserve logoURL fields for company logo deletion
  if (key === 'logoURL') return true;

  // Always preserve multiplePhotoURLs arrays (even empty for deletion)
  if (key === 'multiplePhotoURLs') return true;

  // Preserve Firebase Storage URLs for proper cleanup
  if (typeof value === 'string' && isFirebaseStorageURL(value)) return true;

  return false;
}

/**
 * Clean undefined/null/empty values from object
 *
 * ⚠️ ΚΡΙΣΙΜΗ ΣΗΜΕΙΩΣΗ: Αυτή η function ήταν η αιτία του bug με τις φωτογραφίες!
 * ΜΗ ΑΛΛΑΞΕΙΣ την συμπεριφορά του multiplePhotoURLs - παίζουμε πάνω από 1 ημέρα!
 *
 * 🚀 ENTERPRISE UPGRADE (2025-12-04): Τώρα υποστηρίζει Firebase Storage URLs!
 *
 * @param obj - Object to clean
 * @returns Cleaned object
 */
export function cleanUndefinedValues(obj: any): any {
  const cleaned: any = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];

    // 🚨🚨🚨 ΜΕΓΑΛΗ ΠΡΟΣΟΧΗ - ΜΗ ΑΓΓΙΖΕΙΣ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ! 🚨🚨🚨
    // 🔥 CRITICAL FIX: Preserve empty strings για photoURL deletion
    // ΠΡΟΒΛΗΜΑ: Κενά strings αφαιρούνταν από το cleanUndefinedValues
    // ΛΥΣΗ: Preserve κενά strings για photoURL ώστε να διαγράφεται από τη βάση
    //
    // ⚠️ ΙΣΤΟΡΙΚΟ DEBUGGING: 2025-12-04 - Έκανε 6+ ώρες debugging!
    // ⚠️ ΑΝ ΑΦΑΙΡΕΣΕΙΣ ΤΟ `|| key === 'photoURL'` → οι φωτογραφίες ΔΕΝ θα διαγράφονται!
    // ⚠️ ΤΟ ΠΡΟΒΛΗΜΑ ΗΤΑΝ: photoURL: '' → γινόταν undefined → δεν έφτανε στη Firebase
    // ⚠️ Η ΛΥΣΗ: Εξαίρεση για photoURL ώστε κενά strings να περνάνε στη βάση
    //
    // 🚀 ENTERPRISE UPGRADE (2025-12-04): Τώρα υποστηρίζει και Firebase Storage URLs!
    // 🚨 ΜΗ ΑΛΛΑΞΕΙΣ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ - TESTED & WORKING! 🚨
    if (value !== undefined && value !== null && (value !== '' || requiresSpecialDeletion(key, value))) {
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
        // 🛠️ DEBUG: Log preservation of photoURL empty strings
        if (key === 'photoURL' && value === '') {
          console.log('🛠️ FORM MAPPER: Preserving empty photoURL string for database deletion');
        }
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
  console.log('🚨 EXTRACT MULTIPLE PHOTOS: Starting extraction with formData.multiplePhotos:', {
    length: formData.multiplePhotos?.length || 0,
    isEmpty: (formData.multiplePhotos?.length || 0) === 0,
    photos: formData.multiplePhotos?.map((p, i) => ({
      index: i,
      hasUploadUrl: !!p.uploadUrl,
      uploadUrl: p.uploadUrl?.substring(0, 50) + '...'
    }))
  });

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

  console.log('🚨 EXTRACT MULTIPLE PHOTOS: Final extracted URLs:', {
    urlCount: urls.length,
    isEmpty: urls.length === 0,
    urls: urls.map((url, i) => `${i}: ${url.substring(0, 50)}...`)
  });

  return urls;
}

/**
 * 🏢 ENTERPRISE CENTRALIZED VALIDATION (Legacy Wrapper)
 *
 * @deprecated Use validateAllPhotos from '@/utils/photo/validation' instead
 * This function is kept for backward compatibility
 */
export function validateUploadState(formData: ContactFormData): {
  isValid: boolean;
  pendingUploads: number;
  failedUploads: number;
  totalSlots: number;
  errors: string[];
} {
  // 🔄 FORWARD TO CENTRALIZED VALIDATION
  const { validateAllPhotos } = require('@/utils/photo/validation');
  return validateAllPhotos(formData);
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

  console.log('🔍 FORM MAPPER: extractPhotoURL called for', contactType);
  console.log('🔍 FORM MAPPER: formData.photoURL:', formData.photoURL);
  console.log('🔍 FORM MAPPER: formData.photoPreview:', formData.photoPreview);
  console.log('🔍 FORM MAPPER: formData.multiplePhotos:', formData.multiplePhotos);

  // 🏢 COMPANY SPECIAL CASE: For company representative photo, check photoURL first
  if (contactType.includes('company') || contactType.includes('representative')) {
    console.log('🏢 COMPANY MODE: Checking photoURL for representative photo');

    // Check photoURL first (from UnifiedPhotoManager)
    if (formData.photoURL && formData.photoURL.trim() !== '' && !formData.photoURL.startsWith('blob:')) {
      // Accept both Base64 and Firebase Storage URLs
      if (formData.photoURL.startsWith('data:') || formData.photoURL.includes('firebasestorage.googleapis.com')) {
        console.log('🏢 EXTRACT PHOTO: Using photoURL (company representative):', formData.photoURL.substring(0, 50) + '...');
        return formData.photoURL;
      }
    }

    // Check photoPreview as fallback
    if (formData.photoPreview && formData.photoPreview.trim() !== '' && !formData.photoPreview.startsWith('blob:')) {
      // Accept both Base64 and Firebase Storage URLs
      if (formData.photoPreview.startsWith('data:') || formData.photoPreview.includes('firebasestorage.googleapis.com')) {
        console.log('🏢 EXTRACT PHOTO: Using photoPreview (company representative fallback):', formData.photoPreview.substring(0, 50) + '...');
        return formData.photoPreview;
      }
    }

    console.log('🏢 EXTRACT PHOTO: No company representative photo found');
    return '';
  }

  // 🔥 CRITICAL FIX: Check for intentional deletion vs pending uploads
  // Only consider it deletion if BOTH conditions are met:
  // 1. No uploaded URLs
  // 2. No files with uploading/pending state

  const hasFiles = formData.multiplePhotos && formData.multiplePhotos.length > 0 &&
    formData.multiplePhotos.some(slot => slot.file || slot.isUploading || (slot.uploadProgress && slot.uploadProgress > 0));

  const hasUploadedUrls = formData.multiplePhotos && formData.multiplePhotos.length > 0 &&
    formData.multiplePhotos.some(slot => slot.uploadUrl && slot.uploadUrl.trim() !== '');

  // True deletion: no files AND no URLs
  const isIntentionalDeletion = !hasFiles && !hasUploadedUrls &&
                               (!formData.photoPreview || formData.photoPreview.trim() === '');

  console.log('🔍 FORM MAPPER: isIntentionalDeletion check:', {
    isArray: Array.isArray(formData.multiplePhotos),
    length: formData.multiplePhotos?.length,
    hasFiles: hasFiles,
    hasUploadedUrls: hasUploadedUrls,
    photoPreviewEmpty: (!formData.photoPreview || formData.photoPreview.trim() === ''),
    result: isIntentionalDeletion
  });

  if (isIntentionalDeletion) {
    console.log('🛠️ FORM MAPPER: 🔥 DETECTED INTENTIONAL PHOTO DELETION - RETURNING EMPTY STRING! 🔥');
    return '';
  }

  // 🚀 UPLOAD IN PROGRESS: If we have files but no URLs yet, wait for upload
  if (hasFiles && !hasUploadedUrls) {
    console.log('⏳ FORM MAPPER: Upload in progress - preserving existing photoURL');
    // Return existing photoURL or empty string to preserve state
    return formData.photoURL || '';
  }

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

  // 🔙 HYBRID PRIORITY 3: Extract URLs από multiplePhotoURLs (Base64 OR Firebase)
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  if (multiplePhotoURLs.length > 0) {
    const firstPhoto = multiplePhotoURLs[0];
    // Accept both Base64 and Firebase Storage URLs
    if (firstPhoto.startsWith('data:') || firstPhoto.includes('firebasestorage.googleapis.com')) {
      return firstPhoto;
    }
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
  console.log('🔍 EXTRACT LOGO: contactType:', contactType);
  console.log('🔍 EXTRACT LOGO: logoURL:', formData.logoURL);
  console.log('🔍 EXTRACT LOGO: logoPreview:', formData.logoPreview);

  // 🏢 COMPANY/SERVICE PRIORITY: Check logoURL first (από UnifiedPhotoManager)
  if (formData.logoURL && formData.logoURL.trim() !== '' && !formData.logoURL.startsWith('blob:')) {
    // Accept both Base64 and Firebase Storage URLs
    if (formData.logoURL.startsWith('data:') || formData.logoURL.includes('firebasestorage.googleapis.com')) {
      console.log('🏢 EXTRACT LOGO: Using logoURL (UnifiedPhotoManager):', formData.logoURL.substring(0, 50) + '...');
      return formData.logoURL;
    }
  }

  // 🔄 FALLBACK: Check logoPreview (legacy EnterprisePhotoUpload system)
  if (formData.logoPreview && formData.logoPreview.trim() !== '' && !formData.logoPreview.startsWith('blob:')) {
    // Accept both Base64 and Firebase Storage URLs
    if (formData.logoPreview.startsWith('data:') || formData.logoPreview.includes('firebasestorage.googleapis.com')) {
      console.log('🔙 EXTRACT LOGO: Using legacy logoPreview:', formData.logoPreview.substring(0, 50) + '...');
      return formData.logoPreview;
    }
  }

  // 🏢 ENTERPRISE CENTRALIZED: Check multiplePhotos[0] (για service logos που χρησιμοποιούν MultiplePhotosUpload)
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  if (multiplePhotoURLs.length > 0) {
    const firstPhoto = multiplePhotoURLs[0];
    // Accept both Base64 and Firebase Storage URLs
    if (firstPhoto.startsWith('data:') || firstPhoto.includes('firebasestorage.googleapis.com')) {
      console.log('🏢 EXTRACT LOGO: Using centralized multiplePhotos[0] (fallback):', firstPhoto.substring(0, 50) + '...');
      return firstPhoto;
    }
  }

  console.log('🔍 EXTRACT LOGO: No logo found, returning empty string');
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

  console.log('🚨 MAP INDIVIDUAL: extractPhotoURL returned:', {
    photoURLValue: photoURL,
    photoURLType: typeof photoURL,
    isEmptyString: photoURL === '',
    isUndefined: photoURL === undefined,
    isNull: photoURL === null
  });


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

  console.log('🚨 MAP INDIVIDUAL: Final mapped object photoURL:', {
    returnedPhotoURL: photoURL,
    returnedMultiplePhotoURLsCount: multiplePhotoURLs.length
  });

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
    multiplePhotoURLs,
    emails: createEmailsArray(formData.email),
    phones: createPhonesArray(formData.phone, 'mobile'),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
    address: formData.address,
    city: formData.city,
    postalCode: formData.postalCode,
    email: formData.email,
    phone: formData.phone
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