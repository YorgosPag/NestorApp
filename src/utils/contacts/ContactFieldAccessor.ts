import type { Contact } from '@/types/contacts';

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

    const contactAny = contact as any;

    // 🎯 PRIORITY 1: Arrays format (Individual/Company standard)
    if (contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0) {
      const email = contact.emails[0]?.email;
      if (email && typeof email === 'string') return email.trim();
    }

    // 🎯 PRIORITY 2: Direct field (Service standard)
    if (contactAny.email && typeof contactAny.email === 'string') {
      return contactAny.email.trim();
    }

    // 🎯 PRIORITY 3: Nested formats
    if (contactAny.contactInfo?.email && typeof contactAny.contactInfo.email === 'string') {
      return contactAny.contactInfo.email.trim();
    }

    // 🎯 PRIORITY 4: Legacy formats
    if (contactAny.emailAddress && typeof contactAny.emailAddress === 'string') {
      return contactAny.emailAddress.trim();
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

    const contactAny = contact as any;

    // 🎯 PRIORITY 1: Arrays format (Individual/Company standard)
    if (contact.phones && Array.isArray(contact.phones) && contact.phones.length > 0) {
      const phone = contact.phones[0]?.number;
      if (phone && typeof phone === 'string') return phone.trim();
    }

    // 🎯 PRIORITY 2: Direct field (Service standard)
    if (contactAny.phone && typeof contactAny.phone === 'string') {
      return contactAny.phone.trim();
    }

    // 🎯 PRIORITY 3: Nested formats
    if (contactAny.contactInfo?.phone && typeof contactAny.contactInfo.phone === 'string') {
      return contactAny.contactInfo.phone.trim();
    }

    // 🎯 PRIORITY 4: Legacy formats
    if (contactAny.phoneNumber && typeof contactAny.phoneNumber === 'string') {
      return contactAny.phoneNumber.trim();
    }

    if (contactAny.telephone && typeof contactAny.telephone === 'string') {
      return contactAny.telephone.trim();
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

    const contactAny = contact as any;

    // 🎯 PRIORITY 1: Direct website field
    if (contactAny.website && typeof contactAny.website === 'string') {
      return contactAny.website.trim();
    }

    // 🎯 PRIORITY 2: Official website (Service specific)
    if (contactAny.officialWebsite && typeof contactAny.officialWebsite === 'string') {
      return contactAny.officialWebsite.trim();
    }

    // 🎯 PRIORITY 3: Websites array (future-proof)
    if (contactAny.websites && Array.isArray(contactAny.websites) && contactAny.websites.length > 0) {
      const website = contactAny.websites[0];
      if (website && typeof website === 'string') return website.trim();
    }

    // 🎯 PRIORITY 4: Nested formats
    if (contactAny.contactInfo?.website && typeof contactAny.contactInfo.website === 'string') {
      return contactAny.contactInfo.website.trim();
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

    const contactAny = contact as any;
    const parts: string[] = [];

    // Try direct address
    if (contactAny.address && typeof contactAny.address === 'string') {
      parts.push(contactAny.address.trim());
    }

    // Try structured address
    if (contactAny.serviceAddress) {
      const addr = contactAny.serviceAddress;
      if (addr.street) parts.push(addr.street.trim());
      if (addr.number) parts.push(addr.number.trim());
    }

    // Add postal code and city
    if (contactAny.postalCode && typeof contactAny.postalCode === 'string') {
      parts.push(contactAny.postalCode.trim());
    }

    if (contactAny.city && typeof contactAny.city === 'string') {
      parts.push(contactAny.city.trim());
    }

    return parts.filter(Boolean).join(', ');
  }

  /**
   * 🔍 Debug contact field access
   *
   * Helps identify how fields are stored in different contact types
   */
  static debugFieldAccess(contact: Contact): void {
    console.log('🔍 CONTACT FIELD DEBUG:', {
      contactId: contact.id,
      contactType: contact.type,
      email: ContactFieldAccessor.getEmail(contact),
      phone: ContactFieldAccessor.getPhone(contact),
      website: ContactFieldAccessor.getWebsite(contact),
      rawEmailsArray: (contact as any).emails,
      rawPhonesArray: (contact as any).phones,
      rawEmailDirect: (contact as any).email,
      rawPhoneDirect: (contact as any).phone,
      rawWebsite: (contact as any).website,
      rawOfficialWebsite: (contact as any).officialWebsite
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