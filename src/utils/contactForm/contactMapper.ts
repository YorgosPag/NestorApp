import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { mapIndividualContactToFormData } from './fieldMappers/individualMapper';
import { mapCompanyContactToFormData } from './fieldMappers/companyMapper';
import { mapServiceContactToFormData } from './fieldMappers/serviceMapper';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ContactMapper');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Generic object type for safe field access */
export type SafeFieldSource = object;

/** Generic field value type */
export type SafeFieldValue = unknown;

/** Contact with potential unknown type */
interface UnknownContact extends Omit<Contact, 'type'> {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  serviceName?: string;
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ContactMappingResult {
  formData: ContactFormData;
  warnings: string[];
}

// ============================================================================
// MAIN MAPPER FUNCTIONS
// ============================================================================

/**
 * Map Contact to ContactFormData (for editing)
 *
 * Enterprise-class mapping από Contact model στο form data.
 * Χρησιμοποιεί specialized mappers για κάθε contact type.
 *
 * @param contact - Contact object από τη βάση
 * @returns ContactFormData για το form + warnings array
 */
export function mapContactToFormData(contact: Contact): ContactMappingResult {

  const warnings: string[] = [];

  try {
    let formData: ContactFormData;

    switch (contact.type) {
      case 'individual':
        formData = mapIndividualContactToFormData(contact);
        break;

      case 'company':
        formData = mapCompanyContactToFormData(contact);
        break;

      case 'service':
        formData = mapServiceContactToFormData(contact);
        break;

      default:
        const unknownContact = contact as UnknownContact;
        logger.warn('MAPPER: Unknown contact type:', { type: unknownContact.type });
        warnings.push(`Unknown contact type: ${unknownContact.type}`);

        // Fallback to individual mapping
        formData = mapIndividualContactToFormData(contact);
        break;
    }

    return { formData, warnings };

  } catch (error) {
    logger.error('MAPPER: Contact->FormData mapping failed', { error });

    // Return empty form data with error
    return {
      formData: {
        ...initialFormData,
        type: contact.type,
        id: contact.id
      },
      warnings: [`Mapping failed: ${error}`]
    };
  }
}

/**
 * Validate contact data before mapping
 *
 * @param contact - Contact object to validate
 * @returns Validation warnings array
 */
export function validateContactForMapping(contact: Contact): string[] {
  const warnings: string[] = [];

  if (!contact.type) {
    warnings.push('Contact type is missing');
  }

  if (!contact.id) {
    warnings.push('Contact ID is missing');
  }

  // Type-specific validations
  const unknownContact = contact as UnknownContact;
  switch (contact.type) {
    case 'individual':
      if (!unknownContact.firstName && !unknownContact.lastName) {
        warnings.push('Individual contact missing name information');
      }
      break;

    case 'company':
      if (!unknownContact.companyName) {
        warnings.push('Company contact missing company name');
      }
      break;

    case 'service':
      if (!unknownContact.serviceName) {
        warnings.push('Service contact missing service name');
      }
      break;
  }

  if (warnings.length > 0) {
    logger.warn('MAPPER: Contact validation warnings', { warnings });
  }

  return warnings;
}

function toRecord(value: SafeFieldSource | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Get safe field value with fallback
 *
 * @param obj - Object to extract value from
 * @param field - Field name
 * @param fallback - Fallback value
 * @returns Safe field value
 */
export function getSafeFieldValue<T = SafeFieldValue>(obj: SafeFieldSource | null | undefined, field: string, fallback: T = '' as T): T {
  try {
    const record = toRecord(obj);
    const value = record?.[field];
    return (value !== undefined && value !== null ? value : fallback) as T;
  } catch (error) {
    logger.warn(`MAPPER: Failed to extract field ${field}`, { error });
    return fallback;
  }
}

/**
 * Get safe nested field value with path
 *
 * @param obj - Object to extract value from
 * @param path - Dot notation path (e.g., 'address.street')
 * @param fallback - Fallback value
 * @returns Safe nested field value
 */
export function getSafeNestedValue<T = SafeFieldValue>(obj: SafeFieldSource | null | undefined, path: string, fallback: T = '' as T): T {
  try {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return fallback;
      }
      const record = toRecord(current as SafeFieldSource);
      if (!record) {
        return fallback;
      }
      current = record[key];
    }

    return (current !== undefined && current !== null ? current : fallback) as T;
  } catch (error) {
    logger.warn(`MAPPER: Failed to extract nested field ${path}`, { error });
    return fallback;
  }
}

/**
 * Get safe array field with validation
 *
 * @param obj - Object to extract array from
 * @param field - Field name
 * @param fallback - Fallback array
 * @returns Safe array value
 */
export function getSafeArrayValue<T = unknown>(obj: SafeFieldSource | null | undefined, field: string, fallback: T[] = []): T[] {
  try {
    const record = toRecord(obj);
    const value = record?.[field];
    return Array.isArray(value) ? value : fallback;
  } catch (error) {
    logger.warn(`MAPPER: Failed to extract array field ${field}`, { error });
    return fallback;
  }
}
