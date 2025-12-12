// ============================================================================
// 🏢 ENTERPRISE CONTACT NAME RESOLVER SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΛΥΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Single source of truth για contact name resolution και mapping
// 🔗 USED BY: RelationshipForm, EnterpriseContactDropdown, ContactsList, etc.
// 🏢 STANDARDS: Enterprise-grade centralization, DRY principle
//
// ============================================================================

import type { Contact, ContactType } from '@/types/contacts';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * 🎯 Contact Name Resolution Config
 */
export interface ContactNameConfig {
  /** Fallback για contact χωρίς όνομα */
  fallbackFormat: 'email' | 'phone' | 'id';
  /** Prefix για fallback names */
  fallbackPrefix: {
    individual: string;
    company: string;
    service: string;
  };
  /** Maximum length για display names */
  maxLength?: number;
  /** Debug mode για logging */
  debug?: boolean;
}

/**
 * 📊 Name Resolution Result
 */
export interface NameResolutionResult {
  displayName: string;
  source: 'firstName_lastName' | 'firstName' | 'lastName' | 'name' | 'companyName' | 'serviceName' | 'email_fallback' | 'phone_fallback' | 'id_fallback';
  confidence: number; // 0.0-1.0
}

// ============================================================================
// ENTERPRISE CONFIGURATION
// ============================================================================

/**
 * 🏢 DEFAULT CONFIGURATION
 */
const DEFAULT_CONFIG: ContactNameConfig = {
  fallbackFormat: 'email',
  fallbackPrefix: {
    individual: 'Φυσικό Πρόσωπο',
    company: 'Εταιρεία',
    service: 'Υπηρεσία'
  },
  maxLength: 100,
  debug: false
};

// ============================================================================
// ENTERPRISE CONTACT NAME RESOLVER SERVICE
// ============================================================================

export class ContactNameResolver {

  /**
   * 🎯 PRIMARY NAME RESOLUTION FUNCTION
   *
   * Κεντρικοποιημένη λογική για name resolution με intelligent fallbacks
   */
  static resolveContactDisplayName(
    contact: Partial<Contact>,
    config: Partial<ContactNameConfig> = {}
  ): NameResolutionResult {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    try {
      // Phase 1: Type-specific name resolution
      if (contact.type === 'individual') {
        return this.resolveIndividualName(contact, finalConfig);
      } else if (contact.type === 'company') {
        return this.resolveCompanyName(contact, finalConfig);
      } else if (contact.type === 'service') {
        return this.resolveServiceName(contact, finalConfig);
      }

      // Phase 2: Generic fallback
      return this.resolveGenericName(contact, finalConfig);

    } catch (error) {
      if (finalConfig.debug) {
        console.error('🚨 ContactNameResolver Error:', error);
      }

      // Safe fallback
      return {
        displayName: this.generateFallbackName(contact, finalConfig),
        source: 'id_fallback',
        confidence: 0.1
      };
    }
  }

  /**
   * 👤 Resolve Individual Contact Name
   */
  private static resolveIndividualName(
    contact: Partial<Contact>,
    config: ContactNameConfig
  ): NameResolutionResult {
    // Priority 1: firstName + lastName
    if (contact.firstName && contact.lastName) {
      const displayName = `${contact.firstName.trim()} ${contact.lastName.trim()}`;
      return {
        displayName: this.truncateIfNeeded(displayName, config.maxLength),
        source: 'firstName_lastName',
        confidence: 1.0
      };
    }

    // Priority 2: firstName only
    if (contact.firstName && contact.firstName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.firstName.trim(), config.maxLength),
        source: 'firstName',
        confidence: 0.8
      };
    }

    // Priority 3: lastName only
    if (contact.lastName && contact.lastName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.lastName.trim(), config.maxLength),
        source: 'lastName',
        confidence: 0.8
      };
    }

    // Priority 4: Generic name field
    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.7
      };
    }

    // Priority 5: Fallback με email/phone/id
    return this.generateFallbackResult(contact, 'individual', config);
  }

  /**
   * 🏢 Resolve Company Contact Name
   */
  private static resolveCompanyName(
    contact: Partial<Contact>,
    config: ContactNameConfig
  ): NameResolutionResult {
    // Priority 1: companyName
    if (contact.companyName && contact.companyName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.companyName.trim(), config.maxLength),
        source: 'companyName',
        confidence: 1.0
      };
    }

    // Priority 2: Generic name field
    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.8
      };
    }

    // Priority 3: Fallback
    return this.generateFallbackResult(contact, 'company', config);
  }

  /**
   * 🛠️ Resolve Service Contact Name
   */
  private static resolveServiceName(
    contact: Partial<Contact>,
    config: ContactNameConfig
  ): NameResolutionResult {
    // Priority 1: serviceName
    if (contact.serviceName && contact.serviceName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.serviceName.trim(), config.maxLength),
        source: 'serviceName',
        confidence: 1.0
      };
    }

    // Priority 2: Generic name field
    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.8
      };
    }

    // Priority 3: companyName (αν το service ανήκει σε εταιρεία)
    if (contact.companyName && contact.companyName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.companyName.trim(), config.maxLength),
        source: 'companyName',
        confidence: 0.7
      };
    }

    // Priority 4: Fallback
    return this.generateFallbackResult(contact, 'service', config);
  }

  /**
   * 🌐 Resolve Generic Contact Name
   */
  private static resolveGenericName(
    contact: Partial<Contact>,
    config: ContactNameConfig
  ): NameResolutionResult {
    // Generic name field
    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.6
      };
    }

    // Ultimate fallback
    return this.generateFallbackResult(contact, contact.type || 'individual', config);
  }

  /**
   * 🔧 Generate Fallback Result
   */
  private static generateFallbackResult(
    contact: Partial<Contact>,
    contactType: ContactType | string,
    config: ContactNameConfig
  ): NameResolutionResult {
    const fallbackName = this.generateFallbackName(contact, config, contactType as ContactType);

    // Determine fallback source
    let source: NameResolutionResult['source'] = 'id_fallback';
    if (config.fallbackFormat === 'email' && this.getContactEmail(contact)) {
      source = 'email_fallback';
    } else if (config.fallbackFormat === 'phone' && this.getContactPhone(contact)) {
      source = 'phone_fallback';
    }

    return {
      displayName: fallbackName,
      source,
      confidence: 0.3
    };
  }

  /**
   * 🆔 Generate Fallback Name
   */
  private static generateFallbackName(
    contact: Partial<Contact>,
    config: ContactNameConfig,
    contactType?: ContactType
  ): string {
    const type = contactType || contact.type || 'individual';
    const prefix = config.fallbackPrefix[type] || config.fallbackPrefix.individual;

    if (config.fallbackFormat === 'email') {
      const email = this.getContactEmail(contact);
      if (email) {
        return `${prefix} (${email})`;
      }
    }

    if (config.fallbackFormat === 'phone') {
      const phone = this.getContactPhone(contact);
      if (phone) {
        return `${prefix} (${phone})`;
      }
    }

    // ID fallback
    const idPart = contact.id ? contact.id.substring(0, 8) : 'unknown';
    return `${prefix} #${idPart}`;
  }

  /**
   * ✂️ Truncate If Needed
   */
  private static truncateIfNeeded(text: string, maxLength?: number): string {
    if (!maxLength || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 📧 Get Contact Email
   */
  private static getContactEmail(contact: Partial<Contact>): string | null {
    // Primary email field
    if (contact.email && contact.email.trim()) {
      return contact.email.trim();
    }

    // Emails array (modern structure)
    if (contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0) {
      const primaryEmail = contact.emails.find(e => e.isPrimary);
      if (primaryEmail && primaryEmail.email) {
        return primaryEmail.email;
      }

      // First available email
      const firstEmail = contact.emails[0];
      if (firstEmail && (firstEmail.email || firstEmail.value)) {
        return firstEmail.email || firstEmail.value || null;
      }
    }

    return null;
  }

  /**
   * 📱 Get Contact Phone
   */
  private static getContactPhone(contact: Partial<Contact>): string | null {
    // Primary phone field
    if (contact.phone && contact.phone.trim()) {
      return contact.phone.trim();
    }

    // Phones array (modern structure)
    if (contact.phones && Array.isArray(contact.phones) && contact.phones.length > 0) {
      const primaryPhone = contact.phones.find(p => p.isPrimary);
      if (primaryPhone && primaryPhone.number) {
        return primaryPhone.number;
      }

      // First available phone
      const firstPhone = contact.phones[0];
      if (firstPhone && (firstPhone.number || firstPhone.value)) {
        return firstPhone.number || firstPhone.value || null;
      }
    }

    return null;
  }

  /**
   * 🔄 CONTACT TO CONTACT SUMMARY MAPPER
   *
   * Κεντρικοποιημένη λογική για mapping Contact → ContactSummary
   */
  static mapToContactSummary(
    contact: Contact,
    currentContactId?: string,
    config: Partial<ContactNameConfig> = {}
  ): ContactSummary | null {
    // Force debug logging for this investigation
    const debugMode = false;

    if (debugMode) {
      console.log('🔧 ContactNameResolver.mapToContactSummary processing:', {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        companyName: contact.companyName,
        serviceName: contact.serviceName,
        type: contact.type,
        currentContactId
      });
    }

    // Exclude current contact if specified
    if (currentContactId && contact.id === currentContactId) {
      if (debugMode) {
        console.log('❌ ContactNameResolver: Excluding current contact:', contact.id);
      }
      return null;
    }

    // Resolve display name
    const nameResult = this.resolveContactDisplayName(contact, config);

    if (debugMode) {
      console.log('🔍 Name resolution result for', contact.id, ':', nameResult);
    }

    // Skip contacts with very low confidence (invalid names)
    if (nameResult.confidence < 0.05) { // Lowered threshold to allow more contacts
      if (debugMode || config.debug) {
        console.log('❌ ContactNameResolver: Contact excluded due to low name confidence:', {
          id: contact.id,
          nameResult,
          firstName: contact.firstName,
          lastName: contact.lastName,
          companyName: contact.companyName,
          serviceName: contact.serviceName,
          type: contact.type
        });
      }
      return null;
    }

    // Map to ContactSummary
    const summary = {
      id: contact.id,
      name: nameResult.displayName,
      type: contact.type,
      email: this.getContactEmail(contact) || '',
      phone: this.getContactPhone(contact) || '',
      company: contact.type === 'individual' && contact.company ? contact.company : undefined,
      department: contact.department || '',
      lastActivity: contact.updatedAt?.toString() || contact.createdAt?.toString()
    };

    if (debugMode) {
      console.log('✅ ContactNameResolver: Successfully mapped contact:', {
        id: summary.id,
        name: summary.name,
        type: summary.type,
        confidence: nameResult.confidence,
        source: nameResult.source
      });
    }

    return summary;
  }

  /**
   * 🔄 BATCH MAPPING FUNCTION
   *
   * Κεντρικοποιημένη λογική για mapping πολλών contacts
   */
  static mapContactsToSummaries(
    contacts: Contact[],
    currentContactId?: string,
    config: Partial<ContactNameConfig> = {}
  ): ContactSummary[] {
    return contacts
      .map(contact => this.mapToContactSummary(contact, currentContactId, config))
      .filter((summary): summary is ContactSummary => summary !== null);
  }

  /**
   * 🔍 GET NAME RESOLUTION INFO
   *
   * For debugging - returns detailed information about name resolution
   */
  static getNameResolutionInfo(contact: Partial<Contact>, config: Partial<ContactNameConfig> = {}) {
    const result = this.resolveContactDisplayName(contact, { ...config, debug: true });

    return {
      contact: {
        id: contact.id,
        type: contact.type,
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: contact.name,
        companyName: contact.companyName,
        serviceName: contact.serviceName
      },
      resolution: result,
      availableFields: {
        hasFirstName: !!(contact.firstName && contact.firstName.trim()),
        hasLastName: !!(contact.lastName && contact.lastName.trim()),
        hasName: !!(contact.name && contact.name.trim()),
        hasCompanyName: !!(contact.companyName && contact.companyName.trim()),
        hasServiceName: !!(contact.serviceName && contact.serviceName.trim()),
        hasEmail: !!this.getContactEmail(contact),
        hasPhone: !!this.getContactPhone(contact)
      }
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * 🎯 Quick function για simple name resolution
 */
export const resolveContactDisplayName = (contact: Partial<Contact>, config?: Partial<ContactNameConfig>) => {
  return ContactNameResolver.resolveContactDisplayName(contact, config).displayName;
};

/**
 * 🔄 Quick function για contact mapping
 */
export const mapToContactSummary = (contact: Contact, excludeId?: string, config?: Partial<ContactNameConfig>) => {
  return ContactNameResolver.mapToContactSummary(contact, excludeId, config);
};

/**
 * 🔄 Quick function για batch mapping
 */
export const mapContactsToSummaries = (contacts: Contact[], excludeId?: string, config?: Partial<ContactNameConfig>) => {
  return ContactNameResolver.mapContactsToSummaries(contacts, excludeId, config);
};

// Default export
export default ContactNameResolver;