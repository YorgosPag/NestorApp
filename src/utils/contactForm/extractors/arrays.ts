// ============================================================================
// ARRAY CREATION EXTRACTORS - ENTERPRISE MODULE
// ============================================================================
//
// 📋 Array creation utilities for email and phone fields
// Transforms form string fields into structured Contact model arrays
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import type { EmailInfo, PhoneInfo } from '@/types/contacts';
import EnterpriseContactSaver, { type EnterpriseContactData } from '@/utils/contacts/EnterpriseContactSaver';
import { DEFAULT_PHONE_TYPE, type PhoneOwnerKind, type PhoneType } from '@/lib/contact/phone-type-vocabulary';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Email entry in Contact model format */
interface EmailEntry {
  email: string;
  type: 'work' | 'personal' | 'other';
  isPrimary: boolean;
}

/** Phone entry in Contact model format */
interface PhoneEntry {
  number: string;
  type: PhoneType;
  isPrimary: boolean;
}

// ============================================================================
// ARRAY CREATION FUNCTIONS
// ============================================================================

/**
 * Create emails array from form email field
 *
 * @param email - Email string from form
 * @returns Emails array in Contact model format
 */
export function createEmailsArray(email: string): EmailEntry[] {
  return email ? [{ email, type: 'work', isPrimary: true }] : [];
}

/**
 * Create phones array from form phone field
 *
 * @param phone - Phone string from form
 * @param phoneType - Τύπος από τη ρίζα `PhoneType` — ο καλών δίνει την προεπιλογή του ΚΑΤΟΧΟΥ (ADR-327 §8.5.4)
 * @returns Phones array in Contact model format
 */
export function createPhonesArray(phone: string, phoneType: PhoneType = DEFAULT_PHONE_TYPE.individual): PhoneEntry[] {
  return phone ? [{ number: phone, type: phoneType, isPrimary: true }] : [];
}

// ============================================================================
// ENTERPRISE ARRAYS — ΕΝΑ προοίμιο για τους τρεις create mappers
// ============================================================================

/**
 * Μετατροπή φόρμας σε enterprise δομή + οι πίνακες επικοινωνίας με τα legacy
 * fallback τους.
 *
 * Ήταν αντιγραμμένο **τρεις** φορές, αυτούσιο, στους `mappers/individual.ts`,
 * `mappers/company.ts` και `mappers/service.ts` — με μόνη διαφορά το
 * προεπιλεγμένο είδος τηλεφώνου. Κάθε αλλαγή στη σειρά «πίνακας ή legacy πεδίο;»
 * έπρεπε να γίνει σε τρία σημεία (N.18 / ADR-584: ίδιος κώδικας, διαφορετικό
 * όνομα συνάρτησης-γονέα ⇒ αόρατο στο `ssot:discover`).
 */
export function buildEnterpriseContactArrays(
  formData: ContactFormData,
  // ADR-327 §8.5.4 — ο ΚΑΤΟΧΟΣ, όχι τύπος: εταιρεία/υπηρεσία περνούσαν `'work'`, που η φόρμα τους δεν προσφέρει ⇒ κενό.
  owner: PhoneOwnerKind = 'individual',
): {
  enterpriseData: EnterpriseContactData;
  emails: EmailInfo[];
  phones: PhoneInfo[];
} {
  const enterpriseData = EnterpriseContactSaver.convertToEnterpriseStructure(formData);

  const emails = enterpriseData.emails && enterpriseData.emails.length > 0
    ? enterpriseData.emails
    : createEmailsArray(formData.email);

  const phones = enterpriseData.phones && enterpriseData.phones.length > 0
    ? enterpriseData.phones
    : createPhonesArray(formData.phone, DEFAULT_PHONE_TYPE[owner]);

  return { enterpriseData, emails, phones };
}