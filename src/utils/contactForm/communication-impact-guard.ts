/**
 * 📧 COMMUNICATION FIELD IMPACT GUARD — Change Detection Utility
 *
 * Pure logic module that detects changes to primary communication fields
 * (email, phone, website) and determines if an impact preview is needed.
 *
 * Change types:
 * - primaryEmailChanged: Primary email value changed
 * - primaryPhoneChanged: Primary phone value changed
 * - corporateWebsiteChanged: First corporate website changed
 * - lastEmailRemoved: All emails removed (unsafe)
 * - lastPhoneRemoved: All phones removed (unsafe)
 *
 * @module utils/contactForm/communication-impact-guard
 * @enterprise ADR-280 — Communication Field Impact Detection
 */

import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getPrimaryEmail, getPrimaryPhone } from '@/types/contacts/helpers';

// ============================================================================
// TYPES
// ============================================================================

export type CommunicationChangeType =
  | 'primaryEmailChanged'
  | 'primaryPhoneChanged'
  | 'corporateWebsiteChanged'
  | 'lastEmailRemoved'
  | 'lastPhoneRemoved';

/** A single detected change in a communication field */
export interface CommunicationFieldChange {
  readonly changeType: CommunicationChangeType;
  readonly oldValue: string;
  readonly newValue: string;
  /** True for removal changes (last email/phone removed) */
  readonly isRemoval: boolean;
}

/** Result of analyzing communication field changes */
export interface CommunicationChangeDetection {
  readonly changes: ReadonlyArray<CommunicationFieldChange>;
  readonly hasChanges: boolean;
  /** True when all emails or all phones were removed (blocks submit) */
  readonly hasUnsafeRemoval: boolean;
  /** True when primary email/phone changed or corporate website changed */
  readonly requiresImpactPreview: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract primary email from form data arrays */
function getFormPrimaryEmail(formData: ContactFormData): string {
  const emails = formData.emails ?? [];
  if (emails.length === 0) return '';
  const primary = emails.find((e) => e.isPrimary);
  return (primary?.email ?? emails[0]?.email ?? '').trim();
}

/** Extract primary phone from form data arrays */
function getFormPrimaryPhone(formData: ContactFormData): string {
  const phones = formData.phones ?? [];
  if (phones.length === 0) return '';
  const primary = phones.find((p) => p.isPrimary);
  return (primary?.number ?? phones[0]?.number ?? '').trim();
}

/** Extract first website URL from form data */
function getFormFirstWebsite(formData: ContactFormData): string {
  return (formData.websites?.[0]?.url ?? '').trim();
}

/** Extract first website URL from existing contact */
function getContactFirstWebsite(contact: Contact): string {
  return (contact.websites?.[0]?.url ?? '').trim();
}

/** Check if contact has emails in existing data */
function contactHasEmails(contact: Contact): boolean {
  return (contact.emails?.length ?? 0) > 0;
}

/** Check if contact has phones in existing data */
function contactHasPhones(contact: Contact): boolean {
  return (contact.phones?.length ?? 0) > 0;
}

// ============================================================================
// MAIN DETECTION
// ============================================================================

/**
 * Compare old Contact values vs new form data for communication fields.
 * Returns structured detection result with change types and safety flags.
 *
 * Only meaningful for edit operations (requires editContact).
 */
export function detectCommunicationChanges(
  editContact: Contact,
  formData: ContactFormData
): CommunicationChangeDetection {
  const changes: CommunicationFieldChange[] = [];

  // --- 1. Check primary email change ---
  const oldEmail = (getPrimaryEmail(editContact) ?? '').trim();
  const newEmail = getFormPrimaryEmail(formData);

  if (oldEmail !== newEmail && oldEmail.length > 0 && newEmail.length > 0) {
    changes.push({
      changeType: 'primaryEmailChanged',
      oldValue: oldEmail,
      newValue: newEmail,
      isRemoval: false,
    });
  }

  // --- 2. Check primary phone change ---
  const oldPhone = (getPrimaryPhone(editContact) ?? '').trim();
  const newPhone = getFormPrimaryPhone(formData);

  if (oldPhone !== newPhone && oldPhone.length > 0 && newPhone.length > 0) {
    changes.push({
      changeType: 'primaryPhoneChanged',
      oldValue: oldPhone,
      newValue: newPhone,
      isRemoval: false,
    });
  }

  // --- 3. Check corporate website change ---
  const oldWebsite = getContactFirstWebsite(editContact);
  const newWebsite = getFormFirstWebsite(formData);

  if (oldWebsite !== newWebsite && oldWebsite.length > 0 && newWebsite.length > 0) {
    changes.push({
      changeType: 'corporateWebsiteChanged',
      oldValue: oldWebsite,
      newValue: newWebsite,
      isRemoval: false,
    });
  }

  // --- 4. Check last email removed ---
  const formEmails = formData.emails ?? [];
  if (contactHasEmails(editContact) && formEmails.length === 0) {
    changes.push({
      changeType: 'lastEmailRemoved',
      oldValue: oldEmail,
      newValue: '',
      isRemoval: true,
    });
  }

  // --- 5. Check last phone removed ---
  const formPhones = formData.phones ?? [];
  if (contactHasPhones(editContact) && formPhones.length === 0) {
    changes.push({
      changeType: 'lastPhoneRemoved',
      oldValue: oldPhone,
      newValue: '',
      isRemoval: true,
    });
  }

  // Unsafe removal = all emails or all phones removed
  const hasUnsafeRemoval = changes.some(
    (c) => c.changeType === 'lastEmailRemoved' || c.changeType === 'lastPhoneRemoved'
  );

  // Impact preview for non-removal changes (primary email/phone/website changed)
  const requiresImpactPreview = changes.some((c) => !c.isRemoval);

  return {
    changes,
    hasChanges: changes.length > 0,
    hasUnsafeRemoval,
    requiresImpactPreview,
  };
}
