/**
 * 🏢 COMPANY IDENTITY FIELD GUARD — Change Detection Utility
 *
 * Pure logic module that detects changes to company identity fields
 * and classifies them by criticality category.
 *
 * Categories:
 * - A (Identity-critical): companyName, vatNumber, gemiNumber
 * - B (Accounting/compliance): taxOffice, legalForm, gemiStatus
 * - C (Display/fallback): tradeName
 *
 * @module utils/contactForm/company-identity-guard
 * @enterprise ADR-278 — Company Identity Field Guard
 */

import { isCompanyContact, type Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/** The 7 guarded company identity fields */
export const COMPANY_IDENTITY_FIELDS = [
  'companyName',
  'vatNumber',
  'gemiNumber',
  'taxOffice',
  'legalForm',
  'tradeName',
  'gemiStatus',
] as const;

export type CompanyIdentityField = typeof COMPANY_IDENTITY_FIELDS[number];

/** Criticality category for field classification */
export type FieldCategory = 'A' | 'B' | 'C';

/** A single detected change in an identity field */
export interface IdentityFieldChange {
  readonly field: CompanyIdentityField;
  readonly category: FieldCategory;
  readonly oldValue: string;
  readonly newValue: string;
  /** True when a non-empty value was cleared */
  readonly isCleared: boolean;
}

/** Result of analyzing company identity field changes */
export interface IdentityChangeDetection {
  readonly changes: ReadonlyArray<IdentityFieldChange>;
  readonly hasChanges: boolean;
  /** True when a Category A or B required field was cleared */
  readonly hasUnsafeClear: boolean;
  /** Which fields were unsafely cleared */
  readonly unsafeClearFields: ReadonlyArray<CompanyIdentityField>;
  /** True when at least one Category A or B field changed (requires impact preview) */
  readonly requiresImpactPreview: boolean;
}

// ============================================================================
// FIELD CATEGORY MAP
// ============================================================================

const FIELD_CATEGORY_MAP: Record<CompanyIdentityField, FieldCategory> = {
  companyName: 'A',
  vatNumber: 'A',
  gemiNumber: 'A',
  taxOffice: 'B',
  legalForm: 'B',
  gemiStatus: 'B',
  tradeName: 'C',
};

/** Get the criticality category for a field */
export function getFieldCategory(field: CompanyIdentityField): FieldCategory {
  return FIELD_CATEGORY_MAP[field];
}

// ============================================================================
// FIELD VALUE EXTRACTORS
// ============================================================================

/** Extract a field value from the existing Contact document (company type) */
function extractContactValue(contact: Contact, field: CompanyIdentityField): string {
  const customFields = contact.customFields;

  switch (field) {
    case 'companyName':
      return isCompanyContact(contact) ? contact.companyName ?? '' : '';
    case 'vatNumber':
      return isCompanyContact(contact) ? contact.vatNumber ?? '' : '';
    case 'gemiNumber': {
      // Historically stored under two keys: the canonical `registrationNumber`
      // (CompanyContact type) and the legacy `gemiNumber` top-level key that
      // the mapper still writes for backward compatibility. The form reads
      // `gemiNumber || registrationNumber`, so the guard must mirror that or
      // it will see a phantom "" → "<value>" change on every save for
      // contacts whose `registrationNumber` was never populated.
      if (!isCompanyContact(contact)) return '';
      const legacyGemi = (contact as unknown as { gemiNumber?: unknown }).gemiNumber;
      const legacyGemiStr = typeof legacyGemi === 'string' ? legacyGemi : '';
      return (contact.registrationNumber ?? '') || legacyGemiStr;
    }
    case 'taxOffice':
      return isCompanyContact(contact) ? contact.taxOffice ?? '' : '';
    case 'legalForm':
      return isCompanyContact(contact) ? contact.legalForm ?? '' : '';
    case 'tradeName':
      return isCompanyContact(contact) ? contact.tradeName ?? '' : '';
    case 'gemiStatus': {
      return typeof customFields?.gemiStatus === 'string' ? customFields.gemiStatus : '';
    }
  }
}

/** Extract a field value from the form data */
function extractFormValue(formData: ContactFormData, field: CompanyIdentityField): string {
  switch (field) {
    case 'companyName':
      return formData.companyName?.trim() ?? '';
    case 'vatNumber':
      // Form uses companyVatNumber or vatNumber
      return (formData.companyVatNumber?.trim() || formData.vatNumber?.trim()) ?? '';
    case 'gemiNumber':
      return formData.gemiNumber?.trim() ?? '';
    case 'taxOffice':
      return formData.taxOffice?.trim() ?? '';
    case 'legalForm':
      return (typeof formData.legalForm === 'string' ? formData.legalForm.trim() : '') ?? '';
    case 'tradeName':
      return formData.tradeName?.trim() ?? '';
    case 'gemiStatus':
      return formData.gemiStatus?.trim() ?? '';
  }
}

// ============================================================================
// MAIN DETECTION
// ============================================================================

/**
 * Compare old Contact values vs new form data for the 7 identity fields.
 * Returns a structured detection result with categories and unsafe clear flags.
 */
export function detectCompanyIdentityChanges(
  editContact: Contact,
  formData: ContactFormData
): IdentityChangeDetection {
  const changes: IdentityFieldChange[] = [];
  const unsafeClearFields: CompanyIdentityField[] = [];

  for (const field of COMPANY_IDENTITY_FIELDS) {
    const oldValue = extractContactValue(editContact, field).trim();
    const newValue = extractFormValue(formData, field);

    if (oldValue === newValue) continue;

    const category = getFieldCategory(field);
    const isCleared = oldValue.length > 0 && newValue.length === 0;

    changes.push({ field, category, oldValue, newValue, isCleared });

    // Category A & B: block unsafe clears (required/critical fields)
    if (isCleared && (category === 'A' || category === 'B')) {
      unsafeClearFields.push(field);
    }
  }

  // Impact preview needed if any Cat A or B field has a value change (not just clear)
  const requiresImpactPreview = changes.some(
    (c) => (c.category === 'A' || c.category === 'B') && !c.isCleared
  );

  return {
    changes,
    hasChanges: changes.length > 0,
    hasUnsafeClear: unsafeClearFields.length > 0,
    unsafeClearFields,
    requiresImpactPreview,
  };
}
