// ============================================================================
// 🏢 ENTERPRISE CONTACT NAME RESOLVER SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΛΥΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Single source of truth για contact name resolution
// 🔗 USED BY: RelationshipForm, EnterpriseContactDropdown, ContactsList, etc.
//
// Split (ADR-065 Phase 5):
// - contact-name-resolver-types.ts   → DTO, config, types, field extractors
// - contact-name-resolver-mapper.ts  → Contact→Summary mapping
// - ContactNameResolver.ts (this)    → Core name resolution class
//
// ============================================================================

import type { Contact } from '@/types/contacts';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';

// Re-export all types for backward compatibility
export type {
  ContactInputDTO,
  ContactNameConfig,
  NameResolutionResult,
} from './contact-name-resolver-types';

export { DEFAULT_CONFIG } from './contact-name-resolver-types';

import type {
  ContactInputDTO,
  ContactNameConfig,
  NameResolutionResult,
} from './contact-name-resolver-types';

import {
  DEFAULT_CONFIG,
  getContactEmail,
  getContactPhone,
} from './contact-name-resolver-types';

// Re-export mapper functions for backward compatibility
export {
  mapToContactSummary,
  mapContactsToSummaries,
  contactToDTO,
} from './contact-name-resolver-mapper';

import {
  mapToContactSummary as mapToContactSummaryFn,
  mapContactsToSummaries as mapContactsToSummariesFn,
} from './contact-name-resolver-mapper';

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
    contact: ContactInputDTO,
    config: Partial<ContactNameConfig> = {}
  ): NameResolutionResult {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    try {
      if (contact.type === 'individual') {
        return this.resolveIndividualName(contact, finalConfig);
      } else if (contact.type === 'company') {
        return this.resolveCompanyName(contact, finalConfig);
      } else if (contact.type === 'service') {
        return this.resolveServiceName(contact, finalConfig);
      }

      return this.resolveGenericName(contact, finalConfig);
    } catch (error) {
      if (finalConfig.debug) {
        console.error('🚨 ContactNameResolver Error:', error);
      }

      return {
        displayName: this.generateFallbackName(contact, finalConfig),
        source: 'id_fallback',
        confidence: 0.1
      };
    }
  }

  /** 👤 Resolve Individual Contact Name */
  private static resolveIndividualName(
    contact: ContactInputDTO,
    config: ContactNameConfig
  ): NameResolutionResult {
    if (contact.firstName && contact.lastName) {
      return {
        displayName: this.truncateIfNeeded(`${contact.firstName.trim()} ${contact.lastName.trim()}`, config.maxLength),
        source: 'firstName_lastName',
        confidence: 1.0
      };
    }

    if (contact.firstName && contact.firstName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.firstName.trim(), config.maxLength),
        source: 'firstName',
        confidence: 0.8
      };
    }

    if (contact.lastName && contact.lastName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.lastName.trim(), config.maxLength),
        source: 'lastName',
        confidence: 0.8
      };
    }

    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.7
      };
    }

    return this.generateFallbackResult(contact, 'individual', config);
  }

  /** 🏢 Resolve Company Contact Name */
  private static resolveCompanyName(
    contact: ContactInputDTO,
    config: ContactNameConfig
  ): NameResolutionResult {
    if (contact.companyName && contact.companyName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.companyName.trim(), config.maxLength),
        source: 'companyName',
        confidence: 1.0
      };
    }

    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.8
      };
    }

    return this.generateFallbackResult(contact, 'company', config);
  }

  /** 🛠️ Resolve Service Contact Name */
  private static resolveServiceName(
    contact: ContactInputDTO,
    config: ContactNameConfig
  ): NameResolutionResult {
    if (contact.serviceName && contact.serviceName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.serviceName.trim(), config.maxLength),
        source: 'serviceName',
        confidence: 1.0
      };
    }

    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.8
      };
    }

    if (contact.companyName && contact.companyName.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.companyName.trim(), config.maxLength),
        source: 'companyName',
        confidence: 0.7
      };
    }

    return this.generateFallbackResult(contact, 'service', config);
  }

  /** 🌐 Resolve Generic Contact Name */
  private static resolveGenericName(
    contact: ContactInputDTO,
    config: ContactNameConfig
  ): NameResolutionResult {
    if (contact.name && contact.name.trim()) {
      return {
        displayName: this.truncateIfNeeded(contact.name.trim(), config.maxLength),
        source: 'name',
        confidence: 0.6
      };
    }

    return this.generateFallbackResult(contact, contact.type || 'individual', config);
  }

  /** 🔧 Generate Fallback Result */
  private static generateFallbackResult(
    contact: ContactInputDTO,
    contactType: string,
    config: ContactNameConfig
  ): NameResolutionResult {
    const fallbackName = this.generateFallbackName(contact, config, contactType as 'individual' | 'company' | 'service');

    let source: NameResolutionResult['source'] = 'id_fallback';
    if (config.fallbackFormat === 'email' && getContactEmail(contact)) {
      source = 'email_fallback';
    } else if (config.fallbackFormat === 'phone' && getContactPhone(contact)) {
      source = 'phone_fallback';
    }

    return { displayName: fallbackName, source, confidence: 0.3 };
  }

  /** 🆔 Generate Fallback Name */
  private static generateFallbackName(
    contact: ContactInputDTO,
    config: ContactNameConfig,
    contactType?: 'individual' | 'company' | 'service'
  ): string {
    const type = contactType || contact.type || 'individual';
    const prefix = config.fallbackPrefix[type] || config.fallbackPrefix.individual;

    if (config.fallbackFormat === 'email') {
      const email = getContactEmail(contact);
      if (email) return `${prefix} (${email})`;
    }

    if (config.fallbackFormat === 'phone') {
      const phone = getContactPhone(contact);
      if (phone) return `${prefix} (${phone})`;
    }

    const idPart = contact.id ? contact.id.substring(0, 8) : 'unknown';
    return `${prefix} #${idPart}`;
  }

  /** ✂️ Truncate If Needed */
  private static truncateIfNeeded(text: string, maxLength?: number): string {
    if (!maxLength || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  // ===========================================================================
  // MAPPER DELEGATES (backward compatibility with class static methods)
  // ===========================================================================

  /** Map Contact→ContactSummary (delegates to mapper module) */
  static mapToContactSummary(
    contact: Contact,
    currentContactId?: string,
    config: Partial<ContactNameConfig> = {}
  ): ContactSummary | null {
    return mapToContactSummaryFn(contact, currentContactId, config);
  }

  /** Batch mapping (delegates to mapper module) */
  static mapContactsToSummaries(
    contacts: Contact[],
    currentContactId?: string,
    config: Partial<ContactNameConfig> = {}
  ): ContactSummary[] {
    return mapContactsToSummariesFn(contacts, currentContactId, config);
  }

  /** For debugging - returns detailed information about name resolution */
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
        hasEmail: !!getContactEmail(contact),
        hasPhone: !!getContactPhone(contact)
      }
    };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const resolveContactDisplayName = (contact: ContactInputDTO, config?: Partial<ContactNameConfig>) => {
  return ContactNameResolver.resolveContactDisplayName(contact, config).displayName;
};

export default ContactNameResolver;
