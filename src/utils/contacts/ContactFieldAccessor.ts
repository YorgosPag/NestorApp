import type {
  Contact
} from '../../types/contacts/contracts';



// Extended contact interface για legacy format support
// Intersection type για compatibility με όλα τα existing contact formats
type ExtendedContact = Contact & {
  contactInfo?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  emailAddress?: string;
  phoneNumber?: string;
  telephone?: string; // Legacy phone support
  website?: string; // Direct website access
  legacyWebsites?: string[]; // Legacy websites as strings (not WebsiteInfo[])
  address?: string; // Direct address
  postalCode?: string;
  city?: string;
  email?: string; // Direct email fallback
  phone?: string; // Direct phone fallback
  officialWebsite?: string; // Service websites
};

// ============================================================================
// ENTERPRISE CENTRALIZED CONTACT FIELD ACCESSOR
// ============================================================================

/**
 * 🏢 ENTERPRISE CONTACT FIELD ACCESSOR
 *
 * Κεντρικοποιημένη πρόσβαση σε contact fields που λύνει τη διασπορά:
 *
 * ΠΡΟΒΛΗΜΑ ΔΙΑΣΠΟΡΑΣ:
 * - Individual: email/phone σε arrays (emails[0].email, phones[0].number)
 * - Service: email/phone ως direct fields (contact.email, contact.phone)
 * - Company: μικτή δομή
 *
 * ΛΥΣΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗΣ:
 * - Ενιαίες μέθοδοι που καταλαβαίνουν όλες τις δομές
 * - Single source of truth για field access
 * - Αυτόματη fallback logic
 * - Enterprise-class error handling
 */
export class ContactFieldAccessor {

  /**
   * 📧 Get email from any contact type
   *
   * Handles all possible email storage formats:
   * - Arrays: contact.emails[0].email (Individual/Company)
   * - Direct: contact.email (Service)
   * - Nested: contact.contactInfo.email
   * - Legacy: contact.emailAddress
   */
  static getEmail(contact: Contact): string {
    if (!contact) return '';

    // 🎯 PRIORITY 1: Arrays format (Individual/Company standard)
    if (contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0) {
      const email = contact.emails[0]?.email;
      if (email && typeof email === 'string') return email.trim();
    }

    // 🎯 PRIORITY 2-4: Extended contact fields (legacy support)
    const extendedContact = contact as ExtendedContact;

    // Direct email field
    if (extendedContact.email && typeof extendedContact.email === 'string') {
      return extendedContact.email.trim();
    }

    // Nested format
    if (extendedContact.contactInfo?.email && typeof extendedContact.contactInfo.email === 'string') {
      return extendedContact.contactInfo.email.trim();
    }

    // Legacy format
    if (extendedContact.emailAddress && typeof extendedContact.emailAddress === 'string') {
      return extendedContact.emailAddress.trim();
    }

    return '';
  }

  /**
   * 📞 Get phone from any contact type
   *
   * Handles all possible phone storage formats:
   * - Arrays: contact.phones[0].number (Individual/Company)
   * - Direct: contact.phone (Service)
   * - Nested: contact.contactInfo.phone
   * - Legacy: contact.phoneNumber, contact.telephone
   */
  static getPhone(contact: Contact): string {
    if (!contact) return '';

    // 🎯 PRIORITY 1: Arrays format (Individual/Company standard)
    if (contact.phones && Array.isArray(contact.phones) && contact.phones.length > 0) {
      const phone = contact.phones[0]?.number;
      if (phone && typeof phone === 'string') return phone.trim();
    }

    // 🎯 PRIORITY 2-5: Extended contact fields (legacy support)
    const extendedContact = contact as ExtendedContact;

    // Direct phone field
    if (extendedContact.phone && typeof extendedContact.phone === 'string') {
      return extendedContact.phone.trim();
    }

    // Nested format
    if (extendedContact.contactInfo?.phone && typeof extendedContact.contactInfo.phone === 'string') {
      return extendedContact.contactInfo.phone.trim();
    }

    // Legacy formats
    if (extendedContact.phoneNumber && typeof extendedContact.phoneNumber === 'string') {
      return extendedContact.phoneNumber.trim();
    }

    if (extendedContact.telephone && typeof extendedContact.telephone === 'string') {
      return extendedContact.telephone.trim();
    }

    return '';
  }

  /**
   * 🌐 Get website from any contact type
   *
   * Handles all possible website storage formats:
   * - Direct: contact.website (Service/Company)
   * - Official: contact.officialWebsite (Service)
   * - URLs array: contact.websites[0] (potential future format)
   * - Nested: contact.contactInfo.website
   */
  static getWebsite(contact: Contact): string {
    if (!contact) return '';

    // 🎯 PRIORITY 1: Websites array (standard format για Company/Service)
    if (contact.websites && Array.isArray(contact.websites) && contact.websites.length > 0) {
      const website = contact.websites[0]?.url;
      if (website && typeof website === 'string') return website.trim();
    }

    // 🎯 PRIORITY 2: Extended contact direct website (legacy support)
    const extendedContact = contact as ExtendedContact;
    if (extendedContact.website && typeof extendedContact.website === 'string') {
      return extendedContact.website.trim();
    }

    // 🎯 PRIORITY 3: Legacy websites array (fallback)
    if (extendedContact.legacyWebsites && Array.isArray(extendedContact.legacyWebsites) && extendedContact.legacyWebsites.length > 0) {
      const website = extendedContact.legacyWebsites[0];
      if (website && typeof website === 'string') return website.trim();
    }

    // 🎯 PRIORITY 4: Nested formats
    if (extendedContact.contactInfo?.website && typeof extendedContact.contactInfo.website === 'string') {
      return extendedContact.contactInfo.website.trim();
    }

    // 🎯 PRIORITY 5: Official website (Service legacy support)
    if (extendedContact.officialWebsite && typeof extendedContact.officialWebsite === 'string') {
      return extendedContact.officialWebsite.trim();
    }

    return '';
  }

  /**
   * 🏠 Get full address from any contact type
   *
   * Combines address components into a single string
   */
  static getFullAddress(contact: Contact): string {
    if (!contact) return '';

    const parts: string[] = [];

    // Try direct address field (common across all contact types)
    const extendedContact = contact as ExtendedContact;
    if (extendedContact.address && typeof extendedContact.address === 'string') {
      parts.push(extendedContact.address.trim());
    }

    // Try structured address array (standard format για όλα τα contact types)
    if (contact.addresses && Array.isArray(contact.addresses) && contact.addresses.length > 0) {
      const addr = contact.addresses[0]; // Παίρνουμε την πρώτη διεύθυνση
      const addressParts: string[] = [];
      if (addr.street) addressParts.push(addr.street.trim());
      if (addr.number) addressParts.push(addr.number.trim());
      if (addr.city) addressParts.push(addr.city.trim());
      if (addr.postalCode) addressParts.push(addr.postalCode.trim());
      if (addressParts.length > 0) {
        parts.push(addressParts.join(' '));
      }
    }

    // Add postal code and city (extended fields)
    if (extendedContact.postalCode && typeof extendedContact.postalCode === 'string') {
      parts.push(extendedContact.postalCode.trim());
    }

    if (extendedContact.city && typeof extendedContact.city === 'string') {
      parts.push(extendedContact.city.trim());
    }

    return parts.filter(Boolean).join(', ');
  }

  /**
   * 🔍 Debug contact field access
   *
   * Helps identify how fields are stored in different contact types
   */
  static debugFieldAccess(contact: Contact): void {
    const extendedContact = contact as ExtendedContact; // Legacy fields debug only

    console.log('🔍 CONTACT FIELD DEBUG:', {
      contactId: contact.id,
      contactType: contact.type,
      email: ContactFieldAccessor.getEmail(contact),
      phone: ContactFieldAccessor.getPhone(contact),
      website: ContactFieldAccessor.getWebsite(contact),
      rawEmailsArray: contact.emails,
      rawPhonesArray: contact.phones,
      rawEmailDirect: extendedContact.email,
      rawPhoneDirect: extendedContact.phone,
      rawWebsite: extendedContact.website,
      rawOfficialWebsite: extendedContact.officialWebsite,
      rawWebsitesArray: contact.websites,
      rawAddressesArray: contact.addresses
    });
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS για backward compatibility
// ============================================================================

/**
 * Legacy function wrappers για existing code
 */
export function getContactEmail(contact: Contact): string {
  return ContactFieldAccessor.getEmail(contact);
}

export function getContactPhone(contact: Contact): string {
  return ContactFieldAccessor.getPhone(contact);
}

export function getContactWebsite(contact: Contact): string {
  return ContactFieldAccessor.getWebsite(contact);
}

export function getContactFullAddress(contact: Contact): string {
  return ContactFieldAccessor.getFullAddress(contact);
}

/**
 * 🎯 Type guard για checking αν contact έχει επικοινωνία
 */
export function hasContactInfo(contact: Contact): boolean {
  return !!(
    ContactFieldAccessor.getEmail(contact) ||
    ContactFieldAccessor.getPhone(contact) ||
    ContactFieldAccessor.getWebsite(contact)
  );
}