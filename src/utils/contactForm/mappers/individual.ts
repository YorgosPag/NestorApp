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
import type { AddressInfo, EmailInfo, PhoneInfo, SocialMediaInfo, WebsiteInfo } from '@/types/contacts';
import { extractPhotoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { createEmailsArray, createPhonesArray } from '../extractors/arrays';
import EnterpriseContactSaver from '@/utils/contacts/EnterpriseContactSaver';

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
  socialMedia?: SocialMediaInfo[];
  websites?: WebsiteInfo[];
  photoURL?: string;
  multiplePhotoURLs: string[];
  emails?: EmailInfo[];
  phones?: PhoneInfo[];
  addresses?: AddressInfo[];
  isFavorite: boolean;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
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
  const enterpriseData = EnterpriseContactSaver.convertToEnterpriseStructure(formData);
  const emails = enterpriseData.emails && enterpriseData.emails.length > 0
    ? enterpriseData.emails
    : createEmailsArray(formData.email);
  const phones = enterpriseData.phones && enterpriseData.phones.length > 0
    ? enterpriseData.phones
    : createPhonesArray(formData.phone, 'mobile');

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
    socialMedia: enterpriseData.socialMedia,
    websites: enterpriseData.websites,
    photoURL,
    multiplePhotoURLs, // 📸 Multiple photos array
    emails,
    phones,
    addresses: enterpriseData.addresses,
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
  };
}
