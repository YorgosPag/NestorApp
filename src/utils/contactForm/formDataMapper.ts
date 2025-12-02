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
 *
 * @param formData - Contact form data
 * @returns Multiple photo URLs array
 */
export function extractMultiplePhotoURLs(formData: ContactFormData): string[] {
  const urls: string[] = [];

  console.log('🔍 MAPPER: Extracting multiplePhotoURLs from formData');

  formData.multiplePhotos.forEach((photoSlot, index) => {
    if (photoSlot.uploadUrl) {
      urls.push(photoSlot.uploadUrl);
      console.log(`✅📸 MAPPER: Multiple photo ${index + 1} URL:`, photoSlot.uploadUrl);
    }
  });

  console.log(`📊 MAPPER: Extracted ${urls.length} photo URLs`);
  return urls;
}

/**
 * Extract main photo URL from form data
 *
 * @param formData - Contact form data
 * @param contactType - Contact type for logging
 * @returns Photo URL string
 */
export function extractPhotoURL(formData: ContactFormData, contactType: string): string {
  if (formData.photoPreview && !formData.photoPreview.startsWith('blob:')) {
    console.log(`✅📸 MAPPER: Using existing ${contactType} photo URL:`, formData.photoPreview);
    return formData.photoPreview;
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

  return {
    type: 'company',
    companyName: formData.companyName,
    vatNumber: formData.companyVatNumber,
    logoURL, // 🏢 Enterprise logo URL
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

  return {
    type: 'service',
    serviceName: formData.serviceName,
    serviceType: formData.serviceType,
    logoURL, // 🏛️ Enterprise service logo URL
    photoURL, // 🏛️ Enterprise service representative photo URL
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