/**
 * 🔧 SERVICE IDENTITY FIELD GUARD — Change Detection Utility
 *
 * Pure logic module that detects changes to service identity fields.
 *
 * @module utils/contactForm/service-identity-guard
 */

import { isServiceContact, type Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

export const SERVICE_IDENTITY_FIELDS = [
  'serviceName',
  'shortName',
  'serviceType',
  'serviceCode',
  'category',
  'supervisionMinistry',
  'legalStatus',
] as const;

export type ServiceIdentityField = typeof SERVICE_IDENTITY_FIELDS[number];
export type ServiceIdentityFieldCategory = 'display' | 'administrative';

export interface ServiceIdentityFieldChange {
  readonly field: ServiceIdentityField;
  readonly category: ServiceIdentityFieldCategory;
  readonly oldValue: string;
  readonly newValue: string;
  readonly isCleared: boolean;
}

export interface ServiceIdentityChangeDetection {
  readonly changes: ReadonlyArray<ServiceIdentityFieldChange>;
  readonly hasChanges: boolean;
  readonly requiresImpactPreview: boolean;
}

const FIELD_CATEGORY_MAP: Record<ServiceIdentityField, ServiceIdentityFieldCategory> = {
  serviceName: 'display',
  shortName: 'display',
  serviceType: 'administrative',
  serviceCode: 'administrative',
  category: 'administrative',
  supervisionMinistry: 'administrative',
  legalStatus: 'administrative',
};

function normalizeValue(value: string | undefined | null): string {
  return value?.trim() ?? '';
}

function extractContactValue(contact: Contact, field: ServiceIdentityField): string {
  if (!isServiceContact(contact)) {
    return '';
  }

  const serviceRecord = contact as unknown as Record<string, unknown>;

  switch (field) {
    case 'serviceName':
      return normalizeValue(contact.serviceName);
    case 'shortName':
      return normalizeValue(serviceRecord.shortName as string | undefined);
    case 'serviceType':
      return normalizeValue(contact.serviceType);
    case 'serviceCode':
      return normalizeValue(serviceRecord.serviceCode as string | undefined);
    case 'category':
      return normalizeValue(serviceRecord.category as string | undefined);
    case 'supervisionMinistry':
      return normalizeValue(contact.responsibleMinistry as string | undefined);
    case 'legalStatus':
      return normalizeValue(contact.customFields?.legalStatus as string | undefined);
  }
}

function extractFormValue(formData: ContactFormData, field: ServiceIdentityField): string {
  switch (field) {
    case 'serviceName':
      return normalizeValue(formData.serviceName || formData.name);
    case 'shortName':
      return normalizeValue(formData.shortName);
    case 'serviceType':
      return normalizeValue(formData.serviceType);
    case 'serviceCode':
      return normalizeValue(formData.serviceCode);
    case 'category':
      return normalizeValue(formData.category);
    case 'supervisionMinistry':
      return normalizeValue(formData.supervisionMinistry);
    case 'legalStatus':
      return normalizeValue(formData.legalStatus);
  }
}

export function detectServiceIdentityChanges(
  editContact: Contact,
  formData: ContactFormData,
): ServiceIdentityChangeDetection {
  if (!isServiceContact(editContact) || formData.type !== 'service') {
    return {
      changes: [],
      hasChanges: false,
      requiresImpactPreview: false,
    };
  }

  const changes: ServiceIdentityFieldChange[] = [];

  for (const field of SERVICE_IDENTITY_FIELDS) {
    const oldValue = extractContactValue(editContact, field);
    const newValue = extractFormValue(formData, field);

    if (oldValue === newValue) {
      continue;
    }

    changes.push({
      field,
      category: FIELD_CATEGORY_MAP[field],
      oldValue,
      newValue,
      isCleared: oldValue.length > 0 && newValue.length === 0,
    });
  }

  return {
    changes,
    hasChanges: changes.length > 0,
    requiresImpactPreview: changes.length > 0,
  };
}
