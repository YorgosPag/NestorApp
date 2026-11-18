// ============================================================================
// COMPANY CONTACT MAPPER - ENTERPRISE MODULE
// ============================================================================
//
// 🏢 Company contact form data mapping utilities
// Transforms company contact form data to Contact model structure
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData, KadActivity, CompanyAddress } from '@/types/ContactFormTypes';
import type { AddressInfo, EmailInfo, PhoneInfo, WebsiteInfo } from '@/types/contacts';
import { extractPhotoURL, extractLogoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { buildEnterpriseContactArrays } from '../extractors/arrays';
import { writeCompanyScalarFields } from '../schema/company-field-schema';

/**
 * Custom fields for company contact — τα βαθμωτά από το σχήμα (ADR-332 §D30), οι συλλογές ρητά.
 */
interface CompanyCustomFields extends Record<string, unknown> {
  activities?: KadActivity[];
  companyAddresses?: CompanyAddress[];
}

/**
 * Mapped company contact data (partial, without timestamps).
 * Τα βαθμωτά top-level πεδία (`companyName`, `taxOffice`, …) τα γεννά το σχήμα — ο τύπος εδώ
 * δεν τα απαριθμεί ξανά, αλλιώς θα ήταν τέταρτη χειρόγραφη λίστα.
 */
interface MappedCompanyContactData extends Record<string, unknown> {
  type: 'company';
  logoURL?: string;
  photoURL?: string;
  multiplePhotoURLs: string[];
  emails: EmailInfo[];
  phones: PhoneInfo[];
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];
  isFavorite: boolean;
  status: 'active' | 'inactive' | 'archived';
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
  const { enterpriseData, emails, phones } = buildEnterpriseContactArrays(formData, 'company');
  // ADR-332 §D30: ΚΑΘΕ βαθμωτό πεδίο από τον ΕΝΑ πίνακα — εδώ έλειπε η Δ.Ο.Υ.
  const scalars = writeCompanyScalarFields(formData);

  const result: MappedCompanyContactData = {
    ...scalars.root,
    type: 'company',
    logoURL,
    photoURL,
    multiplePhotoURLs,
    emails,
    phones,
    // Το `convertToEnterpriseStructure` ΕΧΕΙ ΗΔΗ παράγει το `addresses[]` από τα
    // `companyAddresses` (ή από τα flat πεδία όταν δεν υπάρχουν). Η παλιά τοπική
    // `buildAddresses` ξαναέκανε την ίδια μετατροπή και **κέρδιζε** — έχοντας
    // όμως αποκλίνει: πετούσε σιωπηλά το `neighborhood`. Ίδιο μοτίβο με τα
    // αδέλφια `individual.ts` / `service.ts` (ADR-332 D15).
    addresses: enterpriseData.addresses,
    websites: enterpriseData.websites,
    isFavorite: false,
    status: 'active',
    customFields: {
      ...scalars.customFields,
      // Multi-KAD activities array
      activities: formData.activities ?? [],
      // Multi-address array — η λίστα **του saver** (κλαδεμένη, με ταυτότητες), όχι η ωμή
      // της φόρμας. ADR-332 D27 Β-ΙΙ: εδώ γραφόταν το `formData.companyAddresses` αυτούσιο,
      // οπότε η δημιουργία εταιρείας παρέκαμπτε **και** τη δικλείδα D20 **και** τα `id` —
      // ενώ τα αδέλφια `individual.ts` / `service.ts` περνούσαν ήδη από το `enterpriseData`.
      companyAddresses: enterpriseData.customFields?.companyAddresses ?? [],
    }
  };

  return result;
}
