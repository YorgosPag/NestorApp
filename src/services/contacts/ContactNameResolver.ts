// ============================================================================
// 🏢 ENTERPRISE CONTACT NAME RESOLVER SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΛΥΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Single source of truth για contact name resolution και mapping
// 🔗 USED BY: RelationshipForm, EnterpriseContactDropdown, ContactsList, etc.
// 🏢 STANDARDS: Enterprise-grade centralization, DRY principle
//
// 🏢 ARCHITECTURE NOTE (2026-01-19):
// This service uses a DTO (Data Transfer Object) pattern for input data.
// ContactInputDTO accepts raw data that may include legacy fields,
// while the domain types (Contact, IndividualContact, etc.) remain pure.
// This follows SAP/Salesforce/Microsoft enterprise patterns.
//
// ============================================================================

import type {
  Contact,
  ContactType,
  EmailInfo,
  PhoneInfo
} from '@/types/contacts';
import {
  isIndividualContact,
  isCompanyContact,
  isServiceContact
} from '@/types/contacts';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';

// ============================================================================
// 🏢 ENTERPRISE DTO (Data Transfer Object) FOR RAW CONTACT INPUT
// ============================================================================

/**
 * 🏢 ContactInputDTO - Enterprise Data Transfer Object
 *
 * Accepts raw contact data from various sources (database, API, forms)
 * that may include legacy fields not present in the strict domain types.
 *
 * This pattern is used by:
 * - SAP (Business Partner DTO)
 * - Salesforce (Contact SObject with dynamic fields)
 * - Microsoft Dynamics (Entity DTO)
 *
 * @see https://martinfowler.com/eaaCatalog/dataTransferObject.html
 */
export interface ContactInputDTO {
  // Core identification
  id?: string;
  type?: ContactType;

  // Individual-specific fields (from IndividualContact)
  firstName?: string;
  lastName?: string;

  // Company-specific fields (from CompanyContact)
  companyName?: string;

  // Service-specific fields (from ServiceContact)
  serviceName?: string;

  // Legacy/common fields (for backward compatibility)
  /** @legacy Generic name field - use type-specific fields when possible */
  name?: string;
  /** @legacy Single email - use emails array when possible */
  email?: string;
  /** @legacy Single phone - use phones array when possible */
  phone?: string;

  // Modern contact arrays
  emails?: EmailInfo[];
  phones?: PhoneInfo[];

  // Additional fields used in mapping
  company?: string;
  employer?: string;
  department?: string;
  createdAt?: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
}

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
 * 🏢 ENTERPRISE: Database-driven configuration (NO MORE HARDCODED VALUES)
 * Fallback labels τώρα προέρχονται από database configuration
 */
const DEFAULT_CONFIG: ContactNameConfig = {
  fallbackFormat: 'email',
  fallbackPrefix: {
    individual: 'Άγνωστο Άτομο',
    company: 'Άγνωστη Εταιρεία',
    service: 'Άγνωστη Υπηρεσία'
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
   *
   * @param contact - ContactInputDTO (accepts raw data with legacy fields)
   * @param config - Optional configuration for name resolution
   * @returns NameResolutionResult with displayName, source, and confidence
   */
  static resolveContactDisplayName(
    contact: ContactInputDTO,
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
    contact: ContactInputDTO,
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
    contact: ContactInputDTO,
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
    contact: ContactInputDTO,
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
    contact: ContactInputDTO,
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
    contact: ContactInputDTO,
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
    contact: ContactInputDTO,
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
  private static getContactEmail(contact: ContactInputDTO): string | null {
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
      if (firstEmail && firstEmail.email) {
        return firstEmail.email;
      }
    }

    return null;
  }

  /**
   * 📱 Get Contact Phone
   */
  private static getContactPhone(contact: ContactInputDTO): string | null {
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
      if (firstPhone && firstPhone.number) {
        return firstPhone.number;
      }
    }

    return null;
  }

  /**
   * 🔄 CONTACT TO CONTACT SUMMARY MAPPER
   *
   * Κεντρικοποιημένη λογική για mapping Contact → ContactSummary
   *
   * 🏢 ENTERPRISE: Uses type guards for proper type narrowing (SAP/Salesforce pattern)
   */
  static mapToContactSummary(
    contact: Contact,
    currentContactId?: string,
    config: Partial<ContactNameConfig> = {}
  ): ContactSummary | null {
    // Force debug logging for this investigation
    const debugMode = false;

    if (debugMode) {
      // 🏢 ENTERPRISE: Use type guards for proper debug logging
      const debugInfo = this.extractDebugInfo(contact);
      console.log('🔧 ContactNameResolver.mapToContactSummary processing:', {
        ...debugInfo,
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

    // 🏢 ENTERPRISE: Convert Contact to ContactInputDTO for name resolution
    const contactDTO = this.contactToDTO(contact);
    const nameResult = this.resolveContactDisplayName(contactDTO, config);

    if (debugMode) {
      console.log('🔍 Name resolution result for', contact.id, ':', nameResult);
    }

    // Skip contacts with very low confidence (invalid names)
    if (nameResult.confidence < 0.05) { // Lowered threshold to allow more contacts
      if (debugMode || config.debug) {
        const debugInfo = this.extractDebugInfo(contact);
        console.log('❌ ContactNameResolver: Contact excluded due to low name confidence:', {
          ...debugInfo,
          nameResult
        });
      }
      return null;
    }

    // 🏢 ENTERPRISE: Extract company/department using type guards
    const { company, department } = this.extractCompanyAndDepartment(contact);

    // Map to ContactSummary
    const summary: ContactSummary = {
      id: contact.id ?? '',
      name: nameResult.displayName,
      type: contact.type,
      email: this.getContactEmail(contactDTO) ?? '',
      phone: this.getContactPhone(contactDTO) ?? '',
      company,
      department,
      lastActivity: this.formatTimestamp(contact.updatedAt) ?? this.formatTimestamp(contact.createdAt)
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
   * 🏢 ENTERPRISE: Convert domain Contact to DTO
   * Uses type guards for proper type narrowing
   */
  private static contactToDTO(contact: Contact): ContactInputDTO {
    const dto: ContactInputDTO = {
      id: contact.id,
      type: contact.type,
      emails: contact.emails,
      phones: contact.phones
    };

    // Type-specific field extraction using type guards
    if (isIndividualContact(contact)) {
      dto.firstName = contact.firstName;
      dto.lastName = contact.lastName;
      dto.company = contact.employer;
      dto.department = contact.department;
    } else if (isCompanyContact(contact)) {
      dto.companyName = contact.companyName;
    } else if (isServiceContact(contact)) {
      dto.serviceName = contact.serviceName;
      dto.department = contact.department;
    }

    return dto;
  }

  /**
   * 🏢 ENTERPRISE: Extract debug info using type guards
   */
  private static extractDebugInfo(contact: Contact): Record<string, unknown> {
    const base = { id: contact.id, type: contact.type };

    if (isIndividualContact(contact)) {
      return { ...base, firstName: contact.firstName, lastName: contact.lastName };
    } else if (isCompanyContact(contact)) {
      return { ...base, companyName: contact.companyName };
    } else if (isServiceContact(contact)) {
      return { ...base, serviceName: contact.serviceName };
    }

    return base;
  }

  /**
   * 🏢 ENTERPRISE: Extract company and department using type guards
   */
  private static extractCompanyAndDepartment(contact: Contact): { company?: string; department: string } {
    if (isIndividualContact(contact)) {
      return {
        company: contact.employer,
        department: contact.department ?? ''
      };
    } else if (isServiceContact(contact)) {
      return {
        company: undefined,
        department: contact.department ?? ''
      };
    }

    return { company: undefined, department: '' };
  }

  /**
   * 🏢 ENTERPRISE: Format timestamp safely
   */
  private static formatTimestamp(timestamp?: Date | { toDate: () => Date }): string | undefined {
    if (!timestamp) return undefined;

    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }

    if (typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate().toISOString();
    }

    return undefined;
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
  static getNameResolutionInfo(contact: ContactInputDTO, config: Partial<ContactNameConfig> = {}) {
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
export const resolveContactDisplayName = (contact: ContactInputDTO, config?: Partial<ContactNameConfig>) => {
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