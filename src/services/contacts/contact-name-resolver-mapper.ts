// ============================================================================
// 🏢 CONTACT NAME RESOLVER — CONTACT-TO-SUMMARY MAPPER
// ============================================================================
//
// Extracted from ContactNameResolver.ts (ADR-065 Phase 5)
// Maps Contact domain objects to ContactSummary using name resolution
//
// ============================================================================

import type { Contact } from '@/types/contacts';
import {
  isIndividualContact,
  isCompanyContact,
  isServiceContact
} from '@/types/contacts';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { normalizeToISO } from '@/lib/date-local';
import { ContactNameResolver } from './ContactNameResolver';
import type { ContactInputDTO, ContactNameConfig } from './contact-name-resolver-types';
import { getContactEmail, getContactPhone } from './contact-name-resolver-types';

// ============================================================================
// CONTACT → DTO CONVERSION
// ============================================================================

/** Convert domain Contact to ContactInputDTO for name resolution (uses type guards) */
export function contactToDTO(contact: Contact): ContactInputDTO {
  const dto: ContactInputDTO = {
    id: contact.id,
    type: contact.type,
    emails: contact.emails,
    phones: contact.phones
  };

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

// ============================================================================
// DEBUG & FIELD EXTRACTION HELPERS
// ============================================================================

/** Extract debug info from Contact using type guards */
function extractDebugInfo(contact: Contact): Record<string, unknown> {
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

/** Extract company and department from Contact using type guards */
function extractCompanyAndDepartment(contact: Contact): { company?: string; department: string } {
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

/** Format timestamp safely (ADR-218: delegates to centralized normalizeToISO) */
function formatTimestamp(timestamp?: Date | { toDate: () => Date }): string | undefined {
  return normalizeToISO(timestamp) ?? undefined;
}

// ============================================================================
// CONTACT → SUMMARY MAPPING
// ============================================================================

/**
 * Map a single Contact to ContactSummary
 *
 * Uses ContactNameResolver for name resolution with type guards
 * for proper type narrowing (SAP/Salesforce pattern)
 */
export function mapToContactSummary(
  contact: Contact,
  currentContactId?: string,
  config: Partial<ContactNameConfig> = {}
): ContactSummary | null {
  const debugMode = false;

  if (debugMode) {
    const debugInfo = extractDebugInfo(contact);
    console.log('🔧 ContactNameResolver.mapToContactSummary processing:', {
      ...debugInfo,
      currentContactId
    });
  }

  // Exclude current contact if specified
  if (currentContactId && contact.id === currentContactId) {
    return null;
  }

  // Convert to DTO and resolve name
  const contactDTO = contactToDTO(contact);
  const nameResult = ContactNameResolver.resolveContactDisplayName(contactDTO, config);

  if (debugMode) {
    console.log('🔍 Name resolution result for', contact.id, ':', nameResult);
  }

  // Skip contacts with very low confidence (invalid names)
  if (nameResult.confidence < 0.05) {
    if (debugMode || config.debug) {
      const debugInfo = extractDebugInfo(contact);
      console.log('❌ ContactNameResolver: Contact excluded due to low name confidence:', {
        ...debugInfo,
        nameResult
      });
    }
    return null;
  }

  const { company, department } = extractCompanyAndDepartment(contact);

  const summary: ContactSummary = {
    id: contact.id ?? '',
    name: nameResult.displayName,
    type: contact.type,
    email: getContactEmail(contactDTO) ?? '',
    phone: getContactPhone(contactDTO) ?? '',
    company,
    department,
    lastActivity: formatTimestamp(contact.updatedAt) ?? formatTimestamp(contact.createdAt)
  };

  return summary;
}

/**
 * Batch mapping of Contact[] to ContactSummary[]
 */
export function mapContactsToSummaries(
  contacts: Contact[],
  currentContactId?: string,
  config: Partial<ContactNameConfig> = {}
): ContactSummary[] {
  return contacts
    .map(contact => mapToContactSummary(contact, currentContactId, config))
    .filter((summary): summary is ContactSummary => summary !== null);
}
