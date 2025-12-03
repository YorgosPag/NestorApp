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
 * @param obj - Object to clean
 * @returns Cleaned object
 */
export function cleanUndefinedValues(obj: any): any {
  const cleaned: any = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];

    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        if (value.length > 0) cleaned[key] = value;
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

  console.log('🔍 MAPPER HYBRID: Extracting multiplePhotoURLs from formData');

  formData.multiplePhotos.forEach((photoSlot, index) => {
    if (photoSlot.uploadUrl) {
      // 🔙 HYBRID: Accept both Base64 data URLs and Firebase URLs
      if (photoSlot.uploadUrl.startsWith('data:') || photoSlot.uploadUrl.includes('firebasestorage.googleapis.com')) {
        urls.push(photoSlot.uploadUrl);
        const urlType = photoSlot.uploadUrl.startsWith('data:') ? 'Base64' : 'Firebase';
        console.log(`✅📸 MAPPER HYBRID: Multiple photo ${index + 1} URL (${urlType}):`, photoSlot.uploadUrl.substring(0, 50) + '...');
      } else if (photoSlot.uploadUrl.startsWith('blob:')) {
        console.warn(`⚠️ MAPPER HYBRID: Skipping blob URL for photo ${index + 1} - not permanent`);
      }
    }
  });

  console.log(`📊 MAPPER HYBRID: Extracted ${urls.length} photo URLs`);
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
  console.log('🔍 CRITICAL DEBUG: validateUploadState called with formData.multiplePhotos:', formData.multiplePhotos.map((photo, i) => ({
    index: i,
    hasFile: !!photo.file,
    hasPreview: !!photo.preview,
    hasUploadUrl: !!photo.uploadUrl,
    isUploading: !!photo.isUploading,
    error: photo.error
  })));

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
          console.log(`⏳ VALIDATION HYBRID: Photo ${index + 1} still uploading (isUploading=${photoSlot.isUploading}, hasValidUrl=${hasValidUrl})`);
        } else if (photoSlot.error) {
          result.failedUploads++;
          result.errors.push(`Φωτογραφία ${index + 1}: ${photoSlot.error}`);
          console.log(`❌ VALIDATION HYBRID: Photo ${index + 1} upload failed:`, photoSlot.error);
        } else {
          // File selected but upload never started or stalled
          result.pendingUploads++;
          result.errors.push(`Φωτογραφία ${index + 1}: Upload δεν ξεκίνησε`);
          console.log(`⚠️ VALIDATION HYBRID: Photo ${index + 1} upload never started`);
        }
      } else if (hasValidUrl) {
        // 🔙 HYBRID: Photo has valid URL - consider it completed
        console.log(`✅ VALIDATION HYBRID: Photo ${index + 1} completed successfully (${hasValidUrl ? 'Base64/Firebase URL' : 'no URL'})`);
      }
    }
  });

  // 🔙 HYBRID: Check main photo upload state (for Individual/Service contacts)
  if ((formData.type === 'individual' || formData.type === 'service') && formData.photoFile) {
    const hasValidPhotoUrl = formData.photoPreview && (formData.photoPreview.startsWith('data:') || formData.photoPreview.includes('firebasestorage.googleapis.com'));
    if (!hasValidPhotoUrl) {
      result.pendingUploads++;
      result.errors.push('Κύρια φωτογραφία: Εκκρεμής upload');
      console.log('⚠️ HYBRID VALIDATION: Main photo upload pending');
    }
  }

  // 🔙 HYBRID: Check logo upload state (for Company/Service contacts)
  if ((formData.type === 'company' || formData.type === 'service') && formData.logoFile) {
    const hasValidLogoUrl = formData.logoPreview && (formData.logoPreview.startsWith('data:') || formData.logoPreview.includes('firebasestorage.googleapis.com'));
    if (!hasValidLogoUrl) {
      result.pendingUploads++;
      result.errors.push('Logo: Εκκρεμής upload');
      console.log('⚠️ HYBRID VALIDATION: Logo upload pending');
    }
  }

  result.isValid = result.pendingUploads === 0 && result.failedUploads === 0;

  console.log(`🔒 UPLOAD VALIDATION: isValid=${result.isValid}, pending=${result.pendingUploads}, failed=${result.failedUploads}, total=${result.totalSlots}`);

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
  // 🔍 DEBUG: Log what we're extracting
  console.log(`🔍 EXTRACT PHOTO URL DEBUG για ${contactType}:`, {
    photoPreview: formData.photoPreview?.substring(0, 50) + '...',
    isBase64: formData.photoPreview?.startsWith('data:'),
    isBlob: formData.photoPreview?.startsWith('blob:'),
    multiplePhotosCount: formData.multiplePhotos?.length,
    firstPhotoUploadUrl: formData.multiplePhotos?.[0]?.uploadUrl?.substring(0, 50) + '...'
  });

  // 🔙 HYBRID PRIORITY 1: Base64 data URLs from multiplePhotos (για individuals)
  if (formData.multiplePhotos && formData.multiplePhotos.length > 0) {
    const firstPhoto = formData.multiplePhotos[0];
    if (firstPhoto.uploadUrl && firstPhoto.uploadUrl.startsWith('data:')) {
      console.log(`✅📸 MAPPER HYBRID: Using Base64 URL from multiplePhotos for ${contactType}`);
      return firstPhoto.uploadUrl;
    }
  }

  // 🔙 HYBRID PRIORITY 2: Existing Base64 photoPreview
  if (formData.photoPreview && formData.photoPreview.startsWith('data:')) {
    console.log(`✅📸 MAPPER HYBRID: Using existing Base64 ${contactType} photo URL`);
    return formData.photoPreview;
  }

  // 🔙 HYBRID PRIORITY 3: Extract Base64 URLs από multiplePhotoURLs
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  if (multiplePhotoURLs.length > 0 && multiplePhotoURLs[0].startsWith('data:')) {
    console.log(`✅📸 MAPPER HYBRID: Using Base64 URL από multiplePhotoURLs for ${contactType}`);
    return multiplePhotoURLs[0];
  }

  // 🔙 HYBRID FALLBACK: Support existing Firebase URLs (from old working contacts)
  if (formData.photoPreview && formData.photoPreview.includes('firebasestorage.googleapis.com')) {
    console.log(`✅📸 MAPPER HYBRID: Using existing Firebase URL για ${contactType}`);
    return formData.photoPreview;
  }

  // 🚨 HYBRID RULE: NEVER return blob URLs - they are temporary!
  if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
    console.warn(`⚠️ MAPPER HYBRID: Rejecting blob URL - not permanent storage για ${contactType}`);
    return ''; // Κενό string αντί blob URL
  }

  console.log(`❌ MAPPER HYBRID: No valid photo URL found για ${contactType} - returning empty string`);
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
  if (formData.logoPreview && !formData.logoPreview.startsWith('blob:')) {
    console.log(`✅🏢 MAPPER: Using existing ${contactType} logo URL:`, formData.logoPreview);
    return formData.logoPreview;
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

  console.log('💾 MAPPER: Saving individual with multiplePhotoURLs:', multiplePhotoURLs);

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
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData); // 📸 Multiple photos για companies

  console.log('💾 MAPPER: Saving company with multiplePhotoURLs:', multiplePhotoURLs);

  return {
    type: 'company',
    companyName: formData.companyName,
    vatNumber: formData.companyVatNumber,
    logoURL, // 🏢 Enterprise logo URL
    multiplePhotoURLs, // 📸 Multiple photos array για company photos
    emails: createEmailsArray(formData.email),
    phones: createPhonesArray(formData.phone, 'work'),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
  };
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

  console.log('💾 MAPPER: Saving service with multiplePhotoURLs:', multiplePhotoURLs);

  return {
    type: 'service',
    serviceName: formData.serviceName,
    serviceType: formData.serviceType,
    logoURL, // 🏛️ Enterprise service logo URL
    photoURL, // 🏛️ Enterprise service representative photo URL
    multiplePhotoURLs, // 📸 Multiple photos array για service photos
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
  console.log('🔄 MAPPER: Starting formData→contact mapping για type:', formData.type);

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
        break;

      case 'service':
        contactData = mapServiceFormData(formData);
        logoURL = contactData.logoURL;
        photoURL = contactData.photoURL;
        break;

      default:
        throw new Error(`Unknown contact type: ${formData.type}`);
    }

    // Clean undefined values
    const cleanedData = cleanUndefinedValues(contactData);

    console.log('✅ MAPPER: FormData→Contact mapping completed');

    return {
      contactData: cleanedData,
      multiplePhotoURLs,
      photoURL,
      logoURL,
      warnings
    };

  } catch (error) {
    console.error('❌ MAPPER: FormData→Contact mapping failed:', error);

    return {
      contactData: {} as any,
      multiplePhotoURLs: [],
      photoURL: '',
      logoURL: '',
      warnings: [`Mapping failed: ${error}`]
    };
  }
}