// ============================================================================
// COMPANY CONTACT MAPPER - ENTERPRISE MODULE
// ============================================================================
//
// 🏢 Company contact form data mapping utilities
// Transforms company contact form data to Contact model structure
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import type { AddressInfo, EmailInfo, PhoneInfo, WebsiteInfo } from '@/types/contacts';
import { extractPhotoURL, extractLogoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { createEmailsArray, createPhonesArray } from '../extractors/arrays';
import EnterpriseContactSaver from '@/utils/contacts/EnterpriseContactSaver';

/** Custom fields for company contact */
interface CompanyCustomFields {
  gemiStatus?: string;
  gemiStatusDate?: string;
  activityCodeKAD?: string;
  activityDescription?: string;
  activityType?: string;
  chamber?: string;
  capitalAmount?: string;
  currency?: string;
  extraordinaryCapital?: string;
  registrationDate?: string;
  lastUpdateDate?: string;
  gemiDepartment?: string;
  prefecture?: string;
  municipality?: string;
}

/** Mapped company contact data (partial, without timestamps) */
interface MappedCompanyContactData {
  type: 'company';
  companyName?: string;
  vatNumber?: string;
  logoURL?: string;
  photoURL?: string;
  multiplePhotoURLs: string[];
  emails: EmailInfo[];
  phones: PhoneInfo[];
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];
  isFavorite: boolean;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  registrationNumber?: string;
  gemiNumber?: string;
  tradeName?: string;
  legalForm?: string;
  customFields: CompanyCustomFields;
}

/**
 * Map Company Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Company contact data
 */
export function mapCompanyFormData(formData: ContactFormData): MappedCompanyContactData {
  const logoURL = extractLogoURL(formData, 'company');
  const photoURL = extractPhotoURL(formData, 'company representative'); // 🔧 FIX: Εξαγωγή φωτογραφίας εκπροσώπου
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData); // 📸 Multiple photos για companies
  const enterpriseData = EnterpriseContactSaver.convertToEnterpriseStructure(formData);
  const emails = enterpriseData.emails && enterpriseData.emails.length > 0
    ? enterpriseData.emails
    : createEmailsArray(formData.email);
  const phones = enterpriseData.phones && enterpriseData.phones.length > 0
    ? enterpriseData.phones
    : createPhonesArray(formData.phone, 'work');

  // 🔍 DEBUG: Final mapped object
  const result: MappedCompanyContactData = {
    type: 'company',
    companyName: formData.companyName,
    vatNumber: formData.vatNumber, // 🔧 FIX: Use correct field name
    logoURL,
    photoURL,
    multiplePhotoURLs,
    emails,
    phones,
    addresses: enterpriseData.addresses,
    websites: enterpriseData.websites,
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
    registrationNumber: formData.gemiNumber,
    gemiNumber: formData.gemiNumber,
    tradeName: formData.tradeName,
    legalForm: formData.legalForm,
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
