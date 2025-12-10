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
import type { Contact, AddressInfo, WebsiteInfo } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

export interface EnterpriseContactData {
  // Base contact data (unchanged)
  [key: string]: any;

  // Enterprise arrays
  addresses?: AddressInfo[];
  websites?: WebsiteInfo[];

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
  static convertToEnterpriseStructure(formData: ContactFormData): EnterpriseContactData {
    console.log('🏢 ENTERPRISE SAVER: Converting form data to arrays structure');

    const enterpriseData = { ...formData };

    // ========================================================================
    // ADDRESS CONVERSION: flat fields → addresses[]
    // ========================================================================

    const hasAddressData = formData.street || formData.streetNumber ||
                          formData.city || formData.postalCode;

    if (hasAddressData) {
      const primaryAddress: AddressInfo = {
        street: formData.street || '',
        number: formData.streetNumber || '', // Note: flat uses streetNumber, array uses number
        city: formData.city || '',
        postalCode: formData.postalCode || '',
        country: 'GR', // Default to Greece
        type: this.getAddressTypeForContactType(formData.type),
        isPrimary: true,
        label: 'Κύρια Διεύθυνση'
      };

      enterpriseData.addresses = [primaryAddress];
      console.log('🏠 ENTERPRISE SAVER: Created primary address:', primaryAddress);
    }

    // ========================================================================
    // WEBSITE CONVERSION: flat field → websites[]
    // ========================================================================

    if (formData.website && formData.website.trim() !== '') {
      const primaryWebsite: WebsiteInfo = {
        url: formData.website.trim(),
        type: this.getWebsiteTypeForContactType(formData.type),
        label: this.getWebsiteLabelForContactType(formData.type)
      };

      enterpriseData.websites = [primaryWebsite];
      console.log('🌐 ENTERPRISE SAVER: Created primary website:', primaryWebsite);
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
    return enterpriseData;
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
   */
  private static getWebsiteLabelForContactType(contactType: string): string {
    switch (contactType) {
      case 'individual':
        return 'Προσωπική Ιστοσελίδα';
      case 'company':
        return 'Εταιρική Ιστοσελίδα';
      case 'service':
        return 'Επίσημη Ιστοσελίδα';
      default:
        return 'Ιστοσελίδα';
    }
  }

  /**
   * Update existing arrays with new data (maintains other entries)
   *
   * @param existingContact - Current contact from database
   * @param formData - New form data
   * @returns Updated contact with merged arrays
   */
  static updateExistingContact(existingContact: Contact, formData: ContactFormData): EnterpriseContactData {
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