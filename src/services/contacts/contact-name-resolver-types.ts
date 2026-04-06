// ============================================================================
// 🏢 CONTACT NAME RESOLVER — TYPES & DTO
// ============================================================================
//
// Extracted from ContactNameResolver.ts (ADR-065 Phase 5)
// Types, DTO, and configuration for contact name resolution
//
// ============================================================================

import type {
  ContactType,
  EmailInfo,
  PhoneInfo
} from '@/types/contacts';

// ============================================================================
// 🏢 ENTERPRISE DTO (Data Transfer Object) FOR RAW CONTACT INPUT
// ============================================================================

/**
 * 🏢 ContactInputDTO - Enterprise Data Transfer Object
 *
 * Accepts raw contact data from various sources (database, API, forms)
 * that may include legacy fields not present in the strict domain types.
 *
 * @see https://martinfowler.com/eaaCatalog/dataTransferObject.html
 */
export interface ContactInputDTO {
  id?: string;
  type?: ContactType;

  // Individual-specific fields
  firstName?: string;
  lastName?: string;

  // Company-specific fields
  companyName?: string;

  // Service-specific fields
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
// CONFIGURATION & RESULT TYPES
// ============================================================================

/** Contact Name Resolution Config */
export interface ContactNameConfig {
  fallbackFormat: 'email' | 'phone' | 'id';
  fallbackPrefix: {
    individual: string;
    company: string;
    service: string;
  };
  maxLength?: number;
  debug?: boolean;
}

/** Name Resolution Result */
export interface NameResolutionResult {
  displayName: string;
  source: 'firstName_lastName' | 'firstName' | 'lastName' | 'name' | 'companyName' | 'serviceName' | 'email_fallback' | 'phone_fallback' | 'id_fallback';
  confidence: number; // 0.0-1.0
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CONFIG: ContactNameConfig = {
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
// CONTACT FIELD EXTRACTORS
// ============================================================================

/** Extract primary email from ContactInputDTO */
export function getContactEmail(contact: ContactInputDTO): string | null {
  if (contact.email && contact.email.trim()) {
    return contact.email.trim();
  }

  if (contact.emails && Array.isArray(contact.emails) && contact.emails.length > 0) {
    const primaryEmail = contact.emails.find(e => e.isPrimary);
    if (primaryEmail && primaryEmail.email) {
      return primaryEmail.email;
    }

    const firstEmail = contact.emails[0];
    if (firstEmail && firstEmail.email) {
      return firstEmail.email;
    }
  }

  return null;
}

/** Extract primary phone from ContactInputDTO */
export function getContactPhone(contact: ContactInputDTO): string | null {
  if (contact.phone && contact.phone.trim()) {
    return contact.phone.trim();
  }

  if (contact.phones && Array.isArray(contact.phones) && contact.phones.length > 0) {
    const primaryPhone = contact.phones.find(p => p.isPrimary);
    if (primaryPhone && primaryPhone.number) {
      return primaryPhone.number;
    }

    const firstPhone = contact.phones[0];
    if (firstPhone && firstPhone.number) {
      return firstPhone.number;
    }
  }

  return null;
}
