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
 * - lastEmailRemoved: All emails removed (needs impact preview — NOT a block)
 * - lastPhoneRemoved: All phones removed (needs impact preview — NOT a block)
 *
 * 🔑 ADR-944 §3.7 — **φραγμός ανά διεύθυνση, όχι ανά πλήθος**: η αφαίρεση email μπλοκάρεται **μόνο** όταν η
 * διεύθυνση είναι άγκυρα ταυτότητας αποδεκτού λογαριασμού, και αυτό το αποφασίζει ο **server**
 * (`communication-impact-preview`). Εδώ υπολογίζονται μόνο τα κλειδιά που αφαιρούνται (`removedEmailKeys`).
 *
 * @module utils/contactForm/communication-impact-guard
 * @enterprise ADR-280 — Communication Field Impact Detection · ADR-944 §3.7
 */

import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getPrimaryEmail, getPrimaryPhone } from '@/types/contacts/helpers';
import { contactEmailKeys } from '@/lib/contacts/contact-email-keys';

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
  /**
   * Κλειδιά email (SSoT `contactEmailKeys`) που είχε η επαφή και **δεν** έχει η φόρμα — κάθε αφαιρούμενη
   * διεύθυνση, όχι μόνο η τελευταία. Ο server απαντά ποια από αυτά είναι άγκυρες λογαριασμού (ADR-944 §3.7).
   */
  readonly removedEmailKeys: ReadonlyArray<string>;
  /** True when any change (incl. removals) or any removed email needs the server-side impact preview */
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

/**
 * Κλειδιά email της επαφής που **λείπουν** από τη φόρμα. Τα παλιά κλειδιά = πίνακας `emails` ∪ το αποθηκευμένο
 * παράγωγο `emailKeys` (ADR-944 — περιέχει και το επίπεδο `email` του παλαιού σχήματος, που ο τύπος `Contact`
 * δεν δηλώνει). Ένωση, όχι επιλογή: ένα μπαγιάτικο παράγωγο δεν πρέπει να κρύψει αφαίρεση.
 */
export function removedEmailKeysOf(editContact: Contact, formData: ContactFormData): string[] {
  const kept = new Set(contactEmailKeys(formData.emails ?? []));
  const previous = new Set([...contactEmailKeys(editContact.emails ?? []), ...(editContact.emailKeys ?? [])]);
  return [...previous].filter((key) => !kept.has(key)).sort();
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

  // ADR-944 §3.7: καμία αφαίρεση δεν μπλοκάρεται εδώ — όλες περνούν από το preview του server, που ξέρει
  // (α) ποια κλειδιά είναι άγκυρες λογαριασμού (φραγμός) και (β) πόσες εγγραφές αναφέρονται στην επαφή (διάλογος).
  const removedEmailKeys = removedEmailKeysOf(editContact, formData);

  return {
    changes,
    hasChanges: changes.length > 0,
    removedEmailKeys,
    requiresImpactPreview: changes.length > 0 || removedEmailKeys.length > 0,
  };
}
