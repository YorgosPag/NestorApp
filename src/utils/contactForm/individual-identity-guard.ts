/**
 * 👤 INDIVIDUAL IDENTITY FIELD GUARD — Change Detection Utility
 *
 * Pure logic module that detects changes to individual identity fields
 * and classifies them by category for downstream impact previews.
 *
 * @module utils/contactForm/individual-identity-guard
 */

import { isIndividualContact, type Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

export const INDIVIDUAL_IDENTITY_FIELDS = [
  'firstName',
  'lastName',
  'fatherName',
  'motherName',
  'birthDate',
  'birthCountry',
  'gender',
  'amka',
  'vatNumber',
  'taxOffice',
  'documentType',
  'documentIssuer',
  'documentNumber',
  'documentIssueDate',
  'documentExpiryDate',
] as const;

export type IndividualIdentityField = typeof INDIVIDUAL_IDENTITY_FIELDS[number];
export type IndividualIdentityFieldCategory = 'display' | 'identity' | 'regulated' | 'administrative';

export interface IndividualIdentityFieldChange {
  readonly field: IndividualIdentityField;
  readonly category: IndividualIdentityFieldCategory;
  readonly oldValue: string;
  readonly newValue: string;
  readonly isCleared: boolean;
}

export interface IndividualIdentityChangeDetection {
  readonly changes: ReadonlyArray<IndividualIdentityFieldChange>;
  readonly changedFields: ReadonlyArray<IndividualIdentityField>;
  readonly hasChanges: boolean;
  readonly requiresImpactPreview: boolean;
}

const FIELD_CATEGORY_MAP: Record<IndividualIdentityField, IndividualIdentityFieldCategory> = {
  firstName: 'display',
  lastName: 'display',
  fatherName: 'identity',
  motherName: 'identity',
  birthDate: 'identity',
  birthCountry: 'identity',
  gender: 'identity',
  amka: 'regulated',
  vatNumber: 'regulated',
  taxOffice: 'administrative',
  documentType: 'regulated',
  documentIssuer: 'regulated',
  documentNumber: 'regulated',
  documentIssueDate: 'regulated',
  documentExpiryDate: 'regulated',
};

function getFieldCategory(field: IndividualIdentityField): IndividualIdentityFieldCategory {
  return FIELD_CATEGORY_MAP[field];
}

function normalizeValue(value: string | undefined | null): string {
  return value?.trim() ?? '';
}

function extractContactValue(contact: Contact, field: IndividualIdentityField): string {
  if (!isIndividualContact(contact)) {
    return '';
  }

  switch (field) {
    case 'firstName':
      return normalizeValue(contact.firstName);
    case 'lastName':
      return normalizeValue(contact.lastName);
    case 'fatherName':
      return normalizeValue(contact.fatherName);
    case 'motherName':
      return normalizeValue(contact.motherName);
    case 'birthDate':
      return normalizeValue(contact.birthDate);
    case 'birthCountry':
      return normalizeValue(contact.birthCountry);
    case 'gender':
      return normalizeValue(contact.gender);
    case 'amka':
      return normalizeValue(contact.amka);
    case 'vatNumber':
      return normalizeValue(contact.vatNumber);
    case 'taxOffice':
      return normalizeValue(contact.taxOffice);
    case 'documentType':
      return normalizeValue(contact.documentType);
    case 'documentIssuer':
      return normalizeValue(contact.documentIssuer);
    case 'documentNumber':
      return normalizeValue(contact.documentNumber);
    case 'documentIssueDate':
      return normalizeValue(contact.documentIssueDate);
    case 'documentExpiryDate':
      return normalizeValue(contact.documentExpiryDate);
  }
}

function extractFormValue(formData: ContactFormData, field: IndividualIdentityField): string {
  switch (field) {
    case 'firstName':
      return normalizeValue(formData.firstName);
    case 'lastName':
      return normalizeValue(formData.lastName);
    case 'fatherName':
      return normalizeValue(formData.fatherName);
    case 'motherName':
      return normalizeValue(formData.motherName);
    case 'birthDate':
      return normalizeValue(formData.birthDate);
    case 'birthCountry':
      return normalizeValue(formData.birthCountry);
    case 'gender':
      return normalizeValue(formData.gender);
    case 'amka':
      return normalizeValue(formData.amka);
    case 'vatNumber':
      return normalizeValue(formData.vatNumber);
    case 'taxOffice':
      return normalizeValue(formData.taxOffice);
    case 'documentType':
      return normalizeValue(formData.documentType);
    case 'documentIssuer':
      return normalizeValue(formData.documentIssuer);
    case 'documentNumber':
      return normalizeValue(formData.documentNumber);
    case 'documentIssueDate':
      return normalizeValue(formData.documentIssueDate);
    case 'documentExpiryDate':
      return normalizeValue(formData.documentExpiryDate);
  }
}

export function detectIndividualIdentityChanges(
  editContact: Contact,
  formData: ContactFormData,
): IndividualIdentityChangeDetection {
  if (!isIndividualContact(editContact) || formData.type !== 'individual') {
    return {
      changes: [],
      changedFields: [],
      hasChanges: false,
      requiresImpactPreview: false,
    };
  }

  const changes: IndividualIdentityFieldChange[] = [];

  for (const field of INDIVIDUAL_IDENTITY_FIELDS) {
    const oldValue = extractContactValue(editContact, field);
    const newValue = extractFormValue(formData, field);

    if (oldValue === newValue) {
      continue;
    }

    changes.push({
      field,
      category: getFieldCategory(field),
      oldValue,
      newValue,
      isCleared: oldValue.length > 0 && newValue.length === 0,
    });
  }

  return {
    changes,
    changedFields: changes.map((change) => change.field),
    hasChanges: changes.length > 0,
    requiresImpactPreview: changes.length > 0,
  };
}
