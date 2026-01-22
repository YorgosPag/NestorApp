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
    console.log('🏢 ENTERPRISE SAVER: Converting form data to arrays structure');

    const enterpriseData = { ...formData };

    // ========================================================================
    // ADDRESS CONVERSION: flat fields → addresses[]
    // ========================================================================

    const hasAddressData = formData.street || formData.streetNumber ||
                          formData.city || formData.postalCode;

    if (hasAddressData) {
      // 🌐 i18n: Labels converted to i18n keys - 2026-01-18
      const primaryAddress: AddressInfo = {
        street: formData.street || '',
        number: formData.streetNumber || '', // Note: flat uses streetNumber, array uses number
        city: formData.city || '',
        postalCode: formData.postalCode || '',
        country: 'GR', // Default to Greece
        type: this.getAddressTypeForContactType(formData.type || 'individual'),
        isPrimary: true,
        label: 'contacts.address.primary'
      };

      (enterpriseData as any).addresses = [primaryAddress];
      console.log('🏠 ENTERPRISE SAVER: Created primary address:', primaryAddress);
    }

    // ========================================================================
    // WEBSITE CONVERSION: flat field → websites[] OR use existing arrays
    // ========================================================================

    if (formData.websites && Array.isArray(formData.websites) && formData.websites.length > 0) {
      // Use dynamic arrays if available
      enterpriseData.websites = formData.websites;
      console.log('🌐 ENTERPRISE SAVER: Using dynamic websites array:', formData.websites.length, 'items');
    } else if (formData.website && formData.website.trim() !== '') {
      // Fallback to flat field
      const primaryWebsite: WebsiteInfo = {
        url: formData.website.trim(),
        type: this.getWebsiteTypeForContactType(formData.type || 'individual'),
        label: this.getWebsiteLabelForContactType(formData.type || 'individual')
      };

      enterpriseData.websites = [primaryWebsite];
      console.log('🌐 ENTERPRISE SAVER: Created primary website from flat field:', primaryWebsite);
    }

    // ========================================================================
    // PHONES CONVERSION: use dynamic arrays
    // ========================================================================

    if (formData.phones && Array.isArray(formData.phones) && formData.phones.length > 0) {
      enterpriseData.phones = formData.phones;
      console.log('📱 ENTERPRISE SAVER: Using dynamic phones array:', formData.phones.length, 'items');
    }

    // ========================================================================
    // EMAILS CONVERSION: use dynamic arrays
    // ========================================================================

    if (formData.emails && Array.isArray(formData.emails) && formData.emails.length > 0) {
      enterpriseData.emails = formData.emails;
      console.log('✉️ ENTERPRISE SAVER: Using dynamic emails array:', formData.emails.length, 'items');
    }

    // ========================================================================
    // SOCIAL MEDIA CONVERSION: use dynamic arrays
    // ========================================================================

    if (formData.socialMediaArray && Array.isArray(formData.socialMediaArray) && formData.socialMediaArray.length > 0) {
      (enterpriseData as any).socialMedia = formData.socialMediaArray;
      console.log('🌐 ENTERPRISE SAVER: Using dynamic social media array:', formData.socialMediaArray.length, 'items');
    }

    // ========================================================================
    // REMOVE FLAT FIELDS - They should not exist in database
    // ========================================================================

    delete enterpriseData.street;
    delete enterpriseData.streetNumber;
    delete enterpriseData.city;
    delete enterpriseData.postalCode;
    delete enterpriseData.website;

    console.log('✅ ENTERPRISE SAVER: Conversion complete');
    return enterpriseData as EnterpriseContactData;
  }

  /**
   * Get appropriate address type based on contact type
   */
  private static getAddressTypeForContactType(contactType: string): 'home' | 'work' | 'other' {
    switch (contactType) {
      case 'individual':
        return 'home';
      case 'company':
      case 'service':
        return 'work';
      default:
        return 'other';
    }
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
    console.log('🔄 ENTERPRISE SAVER: Updating existing contact with new data');

    const updatedData = { ...existingContact };
    const newData = this.convertToEnterpriseStructure(formData);

    // Merge new data
    Object.assign(updatedData, newData);

    // Special handling for arrays - replace primary entries
    if (newData.addresses && newData.addresses.length > 0) {
      const existingAddresses = updatedData.addresses || [];
      const nonPrimaryAddresses = existingAddresses.filter(addr => !addr.isPrimary);
      updatedData.addresses = [...newData.addresses, ...nonPrimaryAddresses];
    }

    if (newData.websites && newData.websites.length > 0) {
      // Replace all websites for now (simpler logic)
      updatedData.websites = newData.websites;
    }

    console.log('✅ ENTERPRISE SAVER: Update complete');
    return updatedData;
  }
}

export default EnterpriseContactSaver;