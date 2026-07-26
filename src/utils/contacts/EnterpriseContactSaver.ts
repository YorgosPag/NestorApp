// ============================================================================
// ENTERPRISE CONTACT SAVER
// ============================================================================
//
// Handles conversion between flat form fields and enterprise arrays structure
//
// ARCHITECTURE:
// - Takes flat form data (street, streetNumber, etc.)
// - Converts to enterprise arrays (addresses[], websites[])
// - Saves to database using proper structure
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import type { Contact, AddressInfo, WebsiteInfo, PhoneInfo, EmailInfo, SocialMediaInfo } from '@/types/contacts';

import { createModuleLogger } from '@/lib/telemetry';
import { isNonEmptyArray } from '@/lib/type-guards';
import { stripTypeExclusiveFields } from './contact-type-fields';
import {
  buildAddressInfoFromFlatFields,
  buildAddressInfoListFromCompanyAddresses,
} from './address-info-builder';
import {
  COMPANY_ONLY_TOP_LEVEL_FIELDS,
  collectCompanyCustomFields,
} from './enterprise-custom-fields';
const logger = createModuleLogger('EnterpriseContactSaver');

// ============================================================================
// TYPES
// ============================================================================

export interface EnterpriseContactData {
  // Base contact data (unchanged)
  [key: string]: unknown;

  // Enterprise arrays
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];
  phones?: PhoneInfo[];
  emails?: EmailInfo[];
  socialMedia?: SocialMediaInfo[];

  /**
   * Ένθετα πεδία Firestore. Εδώ ζει η **αυθεντική** λίστα διευθύνσεων
   * (`companyAddresses`) για κάθε είδος επαφής — ADR-332 D18.
   */
  customFields?: Record<string, unknown>;

  // Remove flat fields - they should not be saved to database
  street?: never;
  streetNumber?: never;
  city?: never;
  postalCode?: never;
  website?: never;
}

// ============================================================================
// ENTERPRISE CONTACT SAVER
// ============================================================================

export class EnterpriseContactSaver {

  /**
   * Convert flat form data to enterprise arrays structure
   *
   * @param formData - Form data with flat fields
   * @returns Enterprise contact data with arrays
   */
  static convertToEnterpriseStructure(formData: Partial<ContactFormData>): EnterpriseContactData {
    logger.info('ENTERPRISE SAVER: Converting form data to arrays structure');

    const enterpriseData: EnterpriseContactData = { ...formData } as EnterpriseContactData;

    // ========================================================================
    // ADDRESS CONVERSION: flat fields → addresses[]
    // ========================================================================

    const hasAddressData = formData.street || formData.streetNumber ||
                          formData.city || formData.postalCode ||
                          formData.municipality || formData.settlement;

    if (hasAddressData) {
      // Η ΠΑΡΑΓΩΓΗ ΖΕΙ ΣΕ ΕΝΑ ΣΗΜΕΙΟ (ADR-332 D15): ταξινομία ADR-319 για το
      // `label`, προβολή ιεραρχίας και προεπιλογή χώρας απαντιούνται μία φορά
      // στο `address-info-builder`, ώστε flat έδρα και `companyAddresses` να μη
      // μπορούν να αποκλίνουν ξανά.
      const primaryAddress: AddressInfo = buildAddressInfoFromFlatFields(formData);

      enterpriseData.addresses = [primaryAddress];
      logger.info('ENTERPRISE SAVER: Created primary address', { street: primaryAddress.street, city: primaryAddress.city, type: primaryAddress.type });
    }

    // ========================================================================
    // WEBSITE CONVERSION: flat field → websites[] OR use existing arrays
    // ========================================================================

    if (formData.websites && Array.isArray(formData.websites) && formData.websites.length > 0) {
      // Use dynamic arrays if available
      enterpriseData.websites = formData.websites;
      logger.info('ENTERPRISE SAVER: Using dynamic websites array:', { count: formData.websites.length });
    } else if (formData.website && formData.website.trim() !== '') {
      // Fallback to flat field
      const primaryWebsite: WebsiteInfo = {
        url: formData.website.trim(),
        type: this.getWebsiteTypeForContactType(formData.type || 'individual'),
        label: this.getWebsiteLabelForContactType(formData.type || 'individual')
      };

      enterpriseData.websites = [primaryWebsite];
      logger.info('ENTERPRISE SAVER: Created primary website from flat field', { url: primaryWebsite.url, type: primaryWebsite.type });
    }

    // ========================================================================
    // PHONES CONVERSION: use dynamic arrays
    // ========================================================================

    if (formData.phones && Array.isArray(formData.phones) && formData.phones.length > 0) {
      enterpriseData.phones = formData.phones;
      logger.info('ENTERPRISE SAVER: Using dynamic phones array:', { count: formData.phones.length });
    }

    // ========================================================================
    // EMAILS CONVERSION: use dynamic arrays
    // ========================================================================

    if (formData.emails && Array.isArray(formData.emails) && formData.emails.length > 0) {
      enterpriseData.emails = formData.emails;
      logger.info('ENTERPRISE SAVER: Using dynamic emails array:', { count: formData.emails.length });
    }

    // ========================================================================
    // SOCIAL MEDIA CONVERSION: use dynamic arrays
    // ========================================================================

    if (formData.socialMediaArray && Array.isArray(formData.socialMediaArray) && formData.socialMediaArray.length > 0) {
      enterpriseData.socialMedia = formData.socialMediaArray;
      logger.info('ENTERPRISE SAVER: Using dynamic social media array:', { count: formData.socialMediaArray.length });
    }

    // ========================================================================
    // COMPANY CUSTOM FIELDS: form fields → customFields + addresses[]
    // 🏢 ENTERPRISE: Company-specific fields must be nested in customFields
    // for Firestore, because the read mapper (companyMapper.ts) reads from there.
    // ========================================================================

    const customFields: Record<string, unknown> = {};

    // ADR-332 D18: η λίστα διευθύνσεων ανήκει σε ΚΑΘΕ είδος επαφής, όχι μόνο σε
    // εταιρείες. Όσο αυτό το μπλοκ ζούσε μέσα σε `if (type === 'company')`, οι
    // επιπλέον διευθύνσεις φυσικών προσώπων και υπηρεσιών δεν έφταναν ποτέ σε
    // κανένα αποθηκευμένο πεδίο — ούτε στα `customFields`, ούτε στο παράγωγο
    // `addresses[]` (που έμενε η μονή έδρα από τα flat πεδία) — και αμέσως μετά
    // το `stripTypeExclusiveFields` έσβηνε και το top-level αντίγραφο. Το UI
    // όμως τις δεχόταν κανονικά: **σιωπηλή απώλεια δεδομένων στο save.**
    const contactAddresses = formData.companyAddresses;
    if (isNonEmptyArray(contactAddresses)) {
      customFields.companyAddresses = contactAddresses;

      // Το `addresses[]` είναι ΠΑΡΑΓΩΓΟ της αυθεντικής λίστας (ADR-332 D15).
      enterpriseData.addresses = buildAddressInfoListFromCompanyAddresses(contactAddresses);
    }
    // Η αυθεντική λίστα ζει στα `customFields` — ποτέ top-level, για κανέναν τύπο.
    delete (enterpriseData as Record<string, unknown>).companyAddresses;

    if (formData.type === 'company') {
      Object.assign(customFields, collectCompanyCustomFields(formData));

      // Company form-only πεδία — η κανονική τους θέση είναι στα customFields.
      for (const field of COMPANY_ONLY_TOP_LEVEL_FIELDS) {
        delete (enterpriseData as Record<string, unknown>)[field];
      }
    }

    if (Object.keys(customFields).length > 0) {
      (enterpriseData as Record<string, unknown>).customFields = customFields;
      logger.info('ENTERPRISE SAVER: Built customFields', { keys: Object.keys(customFields) });
    }

    // ========================================================================
    // REMOVE FLAT FIELDS FROM PAYLOAD
    // Note: This removes from payload only. Service layer handles deleteField() for updates
    // ========================================================================

    // 🧹 Remove flat address/contact fields (migrated to arrays)
    delete enterpriseData.street;
    delete enterpriseData.streetNumber;
    delete enterpriseData.city;
    delete enterpriseData.postalCode;
    delete enterpriseData.website;
    delete enterpriseData.email;
    delete enterpriseData.phone;

    // 📸 ENTERPRISE: Extract multiplePhotoURLs from multiplePhotos BEFORE cleanup
    // ΚΡΙΣΙΜΟ: Στο UPDATE path, αυτή είναι η ΜΟΝΑΔΙΚΗ ευκαιρία εξαγωγής URLs
    // (Στο CREATE path, οι mappers κάνουν αυτή τη δουλειά μέσω extractMultiplePhotoURLs)
    const rawPhotos = formData.multiplePhotos;
    if (isNonEmptyArray(rawPhotos)) {
      const extractedURLs = rawPhotos
        .map(slot => slot.uploadUrl)
        .filter((url): url is string =>
          typeof url === 'string' &&
          url.trim() !== '' &&
          !url.startsWith('blob:') &&
          (url.includes('firebasestorage.googleapis.com') || url.startsWith('data:'))
        );

      // Always set multiplePhotoURLs — empty array clears deleted photos from Firestore
      enterpriseData.multiplePhotoURLs = extractedURLs;

      if (extractedURLs.length > 0) {
        // 🏢 SERVICE/COMPANY: If contact is service or company, first photo = logoURL
        const contactType = formData.type || enterpriseData.type;
        if (contactType === 'service' || contactType === 'company') {
          enterpriseData.logoURL = extractedURLs[0];
          logger.info('ENTERPRISE SAVER: Extracted logoURL from multiplePhotos for ' + contactType, {
            logoURL: extractedURLs[0].substring(0, 60),
          });
        } else {
          // Individual: first photo = profile photo (if not already set)
          if (!enterpriseData.photoURL || (enterpriseData.photoURL as string).startsWith('blob:')) {
            enterpriseData.photoURL = extractedURLs[0];
          }
        }

        logger.info('ENTERPRISE SAVER: Extracted photo URLs from multiplePhotos', {
          count: extractedURLs.length,
        });
      } else {
        // All photos deleted — clear derived fields too
        const contactType = formData.type || enterpriseData.type;
        if (contactType === 'service' || contactType === 'company') {
          enterpriseData.logoURL = '';
        } else {
          enterpriseData.photoURL = '';
        }
        logger.info('ENTERPRISE SAVER: All photos removed — cleared multiplePhotoURLs');
      }
    }

    // 🛡️ ENTERPRISE: Remove UI-only fields with non-serializable objects
    // ΚΡΙΣΙΜΟ: multiplePhotos περιέχει File objects → Firestore ΑΠΟΡΡΙΠΤΕΙ
    const uiFields = [
      'multiplePhotos', 'photoFile', 'photoPreview', 'logoFile', 'logoPreview',
      'selectedProfilePhotoIndex', 'socialMediaArray',
      '_isLogoUploading', '_isPhotoUploading', '_forceDeleteLogo',
      'activePersonaTab', 'photoFileName',
    ] as const;
    for (const field of uiFields) {
      delete (enterpriseData as Record<string, unknown>)[field];
    }

    // Strip fields that belong to other contact types (prevents form defaults
    // from writing service/company fields onto individual contacts and vice versa).
    const stripped = stripTypeExclusiveFields(
      enterpriseData as Record<string, unknown>,
      formData.type,
    );

    logger.info('ENTERPRISE SAVER: Conversion complete');
    return stripped as EnterpriseContactData;
  }

  /**
   * Get appropriate website type based on contact type
   */
  private static getWebsiteTypeForContactType(contactType: string): 'personal' | 'company' | 'other' {
    switch (contactType) {
      case 'individual':
        return 'personal';
      case 'company':
      case 'service':
        return 'company';
      default:
        return 'other';
    }
  }

  /**
   * Get appropriate website label based on contact type
   * 🌐 i18n: Labels converted to i18n keys - 2026-01-18
   */
  private static getWebsiteLabelForContactType(contactType: string): string {
    switch (contactType) {
      case 'individual':
        return 'contacts.website.personal';
      case 'company':
        return 'contacts.website.company';
      case 'service':
        return 'contacts.website.official';
      default:
        return 'contacts.website.default';
    }
  }

  /**
   * Update existing arrays with new data (maintains other entries)
   *
   * @param existingContact - Current contact from database
   * @param formData - New form data
   * @returns Updated contact with merged arrays
   */
  static updateExistingContact(existingContact: Contact, formData: Partial<ContactFormData>): EnterpriseContactData {
    logger.info('ENTERPRISE SAVER: Updating existing contact with new data');

    const updatedData = { ...existingContact };
    const newData = this.convertToEnterpriseStructure(formData);

    // 🏢 ENTERPRISE: Deep merge customFields before Object.assign (which overwrites)
    // Preserve existing customFields and merge new ones on top
    const existingCustom = (updatedData as Record<string, unknown>).customFields as Record<string, unknown> | undefined;
    const newCustom = (newData as Record<string, unknown>).customFields as Record<string, unknown> | undefined;
    if (newCustom && Object.keys(newCustom).length > 0) {
      (newData as Record<string, unknown>).customFields = {
        ...(existingCustom ?? {}),
        ...newCustom,
      };
    }

    // Merge new data
    Object.assign(updatedData, newData);

    // 🏢 ENTERPRISE: Clean up orphaned fields when contact type switches
    const oldType = existingContact.type;
    const newType = (newData as Record<string, unknown>).type as string | undefined;
    if (newType && oldType !== newType) {
      const record = updatedData as Record<string, unknown>;
      if (newType === 'company') {
        // Switching TO company → clear individual-only fields
        delete record.firstName;
        delete record.lastName;
        delete record.fatherName;
        delete record.motherName;
        delete record.birthDate;
        delete record.birthCountry;
        delete record.gender;
        delete record.amka;
        delete record.documentType;
        delete record.documentNumber;
        delete record.documentIssuer;
        delete record.documentIssueDate;
        delete record.documentExpiryDate;
        delete record.personas;
      } else if (newType === 'individual') {
        // Switching TO individual → clear company-only fields
        delete record.companyName;
        delete record.tradeName;
        delete record.legalForm;
        delete record.gemiNumber;
        delete record.gemiStatus;
        delete record.gemiStatusDate;
        delete record.chamber;
        delete record.capitalAmount;
        delete record.extraordinaryCapital;
        delete record.shareholders;
        delete record.representatives;
        delete record.branches;
        delete record.companyAddresses;
      }
      logger.info('ENTERPRISE SAVER: Type switch cleanup', { from: oldType, to: newType });
    }

    // Replace addresses with the new set (company multi-address or single primary)
    if (newData.addresses && newData.addresses.length > 0) {
      updatedData.addresses = newData.addresses;
    }

    if (newData.websites && newData.websites.length > 0) {
      // Replace all websites for now (simpler logic)
      updatedData.websites = newData.websites;
    }

    // Remove legacy flat fields from the data object
    // Note: Service layer will handle actual Firestore deletion with deleteField()
    delete (updatedData as Record<string, unknown>).email;
    delete (updatedData as Record<string, unknown>).phone;
    delete (updatedData as Record<string, unknown>).street;
    delete (updatedData as Record<string, unknown>).streetNumber;
    delete (updatedData as Record<string, unknown>).city;
    delete (updatedData as Record<string, unknown>).postalCode;
    delete (updatedData as Record<string, unknown>).website;
    // Administrative Hierarchy flat fields → stored inside addresses[]
    delete (updatedData as Record<string, unknown>).municipality;
    delete (updatedData as Record<string, unknown>).municipalityId;
    delete (updatedData as Record<string, unknown>).regionalUnit;
    delete (updatedData as Record<string, unknown>).decentAdmin;
    delete (updatedData as Record<string, unknown>).majorGeo;
    delete (updatedData as Record<string, unknown>).settlement;
    delete (updatedData as Record<string, unknown>).settlementId;
    delete (updatedData as Record<string, unknown>).community;
    delete (updatedData as Record<string, unknown>).municipalUnit;

    logger.info('ENTERPRISE SAVER: Update complete');
    return updatedData;
  }
}

export default EnterpriseContactSaver;
