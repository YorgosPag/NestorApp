// ============================================================================
// INDIVIDUAL CONTACT MAPPER - ENTERPRISE MODULE
// ============================================================================
//
// 👤 Individual contact form data mapping utilities
// Transforms individual contact form data to Contact model structure
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import type { EmailInfo, PhoneInfo, SocialMediaInfo } from '@/types/contacts';
import { extractPhotoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { createEmailsArray, createPhonesArray } from '../extractors/arrays';

/** Mapped individual contact data (partial, without timestamps) */
interface MappedIndividualContactData {
  type: 'individual';
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  motherName?: string;
  birthDate?: string;
  birthCountry?: string;
  gender?: string;
  amka?: string;
  documentType?: string;
  documentIssuer?: string;
  documentNumber?: string;
  documentIssueDate?: string;
  documentExpiryDate?: string;
  vatNumber?: string;
  taxOffice?: string;
  profession?: string;
  specialty?: string;
  employer?: string;
  position?: string;
  workAddress?: string;
  workWebsite?: string;
  socialMedia?: SocialMediaInfo | Record<string, string>;
  websites?: string;
  photoURL?: string;
  multiplePhotoURLs: string[];
  emails: EmailInfo[];
  phones: PhoneInfo[];
  isFavorite: boolean;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
}

/**
 * Map Individual Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Individual contact data
 */
export function mapIndividualFormData(formData: ContactFormData): MappedIndividualContactData {
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  const photoURL = extractPhotoURL(formData, 'individual');

  console.log('🚨 MAP INDIVIDUAL: extractPhotoURL returned:', {
    photoURLValue: photoURL,
    photoURLType: typeof photoURL,
    isEmptyString: photoURL === '',
    isUndefined: photoURL === undefined,
    isNull: photoURL === null
  });

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