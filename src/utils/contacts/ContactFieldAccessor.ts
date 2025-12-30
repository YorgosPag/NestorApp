import type {
  Contact,
  IndividualContact,
  CompanyContact,
  ServiceContact
} from '@/types/contacts';
import {
  isIndividualContact,
  isCompanyContact,
  isServiceContact
} from '@/types/contacts';

// Extended contact interface για legacy format support
interface ExtendedContact extends Contact {
  contactInfo?: {
    email?: string;
    phone?: string;
  };
  emailAddress?: string;
  phoneNumber?: string;
}

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

    // 🎯 PRIORITY 2: Direct field (Service standard)
    if (isServiceContact(contact) && contact.email && typeof contact.email === 'string') {
      return contact.email.trim();
    }

    // 🎯 PRIORITY 3: Nested formats (legacy/extended contact types)
    const extendedContact = contact as ExtendedContact;
    if (extendedContact.contactInfo?.email && typeof extendedContact.contactInfo.email === 'string') {
      return extendedContact.contactInfo.email.trim();
    }

    // 🎯 PRIORITY 4: Legacy formats
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

    // 🎯 PRIORITY 2: Direct field (Service standard)
    if (isServiceContact(contact) && contact.phone && typeof contact.phone === 'string') {
      return contact.phone.trim();
    }

    // 🎯 PRIORITY 3: Nested formats (legacy/extended contact types)
    const extendedContact = contact as ExtendedContact;
    if (extendedContact.contactInfo?.phone && typeof extendedContact.contactInfo.phone === 'string') {
      return extendedContact.contactInfo.phone.trim();
    }

    // 🎯 PRIORITY 4: Legacy formats
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

    // 🎯 PRIORITY 1: Direct website field (Company/Service)
    if (isCompanyContact(contact) && contact.website && typeof contact.website === 'string') {
      return contact.website.trim();
    }

    // 🎯 PRIORITY 2: Official website (Service specific)
    if (isServiceContact(contact) && contact.officialWebsite && typeof contact.officialWebsite === 'string') {
      return contact.officialWebsite.trim();
    }

    // 🎯 PRIORITY 3: Extended/legacy website fields
    const extendedContact = contact as ExtendedContact;
    if (extendedContact.website && typeof extendedContact.website === 'string') {
      return extendedContact.website.trim();
    }

    // 🎯 PRIORITY 4: Websites array (future-proof)
    if (extendedContact.websites && Array.isArray(extendedContact.websites) && extendedContact.websites.length > 0) {
      const website = extendedContact.websites[0];
      if (website && typeof website === 'string') return website.trim();
    }

    // 🎯 PRIORITY 5: Nested formats
    if (extendedContact.contactInfo?.website && typeof extendedContact.contactInfo.website === 'string') {
      return extendedContact.contactInfo.website.trim();
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

    // Try structured address (Service contact specific)
    if (isServiceContact(contact) && contact.serviceAddress) {
      const addr = contact.serviceAddress;
      if (addr.street) parts.push(addr.street.trim());
      if (addr.number) parts.push(addr.number.trim());
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
      rawEmailDirect: isServiceContact(contact) ? contact.email : extendedContact.email,
      rawPhoneDirect: isServiceContact(contact) ? contact.phone : extendedContact.phone,
      rawWebsite: isCompanyContact(contact) ? contact.website : extendedContact.website,
      rawOfficialWebsite: isServiceContact(contact) ? contact.officialWebsite : extendedContact.officialWebsite
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