import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { mapIndividualContactToFormData } from './fieldMappers/individualMapper';
import { mapCompanyContactToFormData } from './fieldMappers/companyMapper';
import { mapServiceContactToFormData } from './fieldMappers/serviceMapper';

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
  console.log('🔄 MAPPER: Starting contact→formData mapping για type:', contact.type);

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
        console.warn('⚠️ MAPPER: Unknown contact type:', (contact as any).type);
        warnings.push(`Unknown contact type: ${(contact as any).type}`);

        // Fallback to individual mapping
        formData = mapIndividualContactToFormData(contact as any);
        break;
    }

    console.log('✅ MAPPER: Contact→FormData mapping completed');
    return { formData, warnings };

  } catch (error) {
    console.error('❌ MAPPER: Contact→FormData mapping failed:', error);

    // Return empty form data with error
    return {
      formData: {
        type: contact.type,
        firstName: '',
        lastName: '',
        companyName: '',
        serviceName: '',
        email: '',
        phone: '',
        notes: '',

        // Initialize all other required fields
        fatherName: '',
        motherName: '',
        birthDate: '',
        birthCountry: '',
        gender: '',
        amka: '',
        documentType: '',
        documentIssuer: '',
        documentNumber: '',
        documentIssueDate: '',
        documentExpiryDate: '',
        vatNumber: '',
        taxOffice: '',
        profession: '',
        specialty: '',
        employer: '',
        position: '',
        workAddress: '',
        workWebsite: '',
        socialMedia: {
          facebook: '',
          instagram: '',
          linkedin: '',
          twitter: ''
        },
        websites: '',
        companyVatNumber: '',
        serviceType: 'other',
        gemiNumber: '',
        serviceVatNumber: '',
        serviceTaxOffice: '',
        serviceTitle: '',
        tradeName: '',
        legalForm: '',
        gemiStatus: '',
        gemiStatusDate: '',
        chamber: '',
        isBranch: false,
        registrationMethod: '',
        registrationDate: '',
        lastUpdateDate: '',
        gemiDepartment: '',
        prefecture: '',
        municipality: '',
        activityCodeKAD: '',
        activityDescription: '',
        activityType: 'main',
        activityValidFrom: '',
        activityValidTo: '',
        capitalAmount: '',
        currency: '',
        extraordinaryCapital: '',
        serviceCode: '',
        parentMinistry: '',
        serviceCategory: '',
        officialWebsite: '',
        serviceAddress: {
          street: '',
          number: '',
          postalCode: '',
          city: ''
        },
        representatives: [],
        shareholders: [],
        branches: [],
        documents: {
          announcementDocs: [],
          registrationDocs: []
        },
        decisions: [],
        announcements: [],
        logoFile: null,
        logoPreview: '',
        photoFile: null,
        photoPreview: '',
        multiplePhotos: []
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
  switch (contact.type) {
    case 'individual':
      if (!(contact as any).firstName && !(contact as any).lastName) {
        warnings.push('Individual contact missing name information');
      }
      break;

    case 'company':
      if (!(contact as any).companyName) {
        warnings.push('Company contact missing company name');
      }
      break;

    case 'service':
      if (!(contact as any).serviceName) {
        warnings.push('Service contact missing service name');
      }
      break;
  }

  if (warnings.length > 0) {
    console.warn('⚠️ MAPPER: Contact validation warnings:', warnings);
  }

  return warnings;
}

/**
 * Get safe field value with fallback
 *
 * @param obj - Object to extract value from
 * @param field - Field name
 * @param fallback - Fallback value
 * @returns Safe field value
 */
export function getSafeFieldValue(obj: any, field: string, fallback: any = ''): any {
  try {
    const value = obj?.[field];
    return value !== undefined && value !== null ? value : fallback;
  } catch (error) {
    console.warn(`⚠️ MAPPER: Failed to extract field ${field}:`, error);
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
export function getSafeNestedValue(obj: any, path: string, fallback: any = ''): any {
  try {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return fallback;
      }
      current = current[key];
    }

    return current !== undefined && current !== null ? current : fallback;
  } catch (error) {
    console.warn(`⚠️ MAPPER: Failed to extract nested field ${path}:`, error);
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
export function getSafeArrayValue(obj: any, field: string, fallback: any[] = []): any[] {
  try {
    const value = obj?.[field];
    return Array.isArray(value) ? value : fallback;
  } catch (error) {
    console.warn(`⚠️ MAPPER: Failed to extract array field ${field}:`, error);
    return fallback;
  }
}