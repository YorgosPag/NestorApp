import { Contact, ServiceContact, AddressInfo, isIndividualContact, isCompanyContact, isServiceContact } from './contracts';
import { PHONE_REGEX } from '@/lib/validation/phone-validation';

// 🏢 ENTERPRISE: Type-safe interface for legacy service contact fields
// These fields may exist in older service contacts but are not in the standard schema
interface LegacyServiceContactFields {
  email?: string;
  contactEmail?: string;
  officialEmail?: string;
  phone?: string;
  telephone?: string;
  centralPhone?: string;
}

// 🏢 ENTERPRISE: Type guard for legacy service contact fields
function hasLegacyServiceFields(contact: Contact): contact is ServiceContact & LegacyServiceContactFields {
  return isServiceContact(contact);
}

// Validation schemas (για χρήση με zod αργότερα)
export const contactValidationRules = {
  individual: {
    firstName: { required: true, minLength: 2, maxLength: 50 },
    lastName: { required: true, minLength: 2, maxLength: 50 },
    email: { required: false, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    phone: { required: false, pattern: PHONE_REGEX },
    taxNumber: { required: false, length: 9, pattern: /^[0-9]{9}$/ }
  },
  company: {
    companyName: { required: true, minLength: 2, maxLength: 100 },
    vatNumber: { required: true, length: 9, pattern: /^[0-9]{9}$/ },
    legalForm: { required: true }
  },
  service: {
    serviceName: { required: true, minLength: 2, maxLength: 100 },
    serviceType: { required: true }
  }
};

// Helper functions
export function getContactDisplayName(contact: Contact): string {
  if (isIndividualContact(contact)) {
    return `${contact.firstName} ${contact.lastName}`;
  } else if (isCompanyContact(contact)) {
    return contact.companyName;
  } else {
    return contact.serviceName;
  }
}

/**
 * **ΤΑ ΑΡΧΙΚΑ ΕΝΟΣ ΟΝΟΜΑΤΟΣ** — 1-2 κεφαλαία γράμματα, ή `''` όταν δεν υπάρχει γράμμα.
 *
 * ADR-209 Φάση 8 όρισε αυτή τη συνάρτηση ως **τη μία** — και μέχρι το ADR-841 Α21.1
 * είχε **τρεις ζωντανούς παραβάτες** που έδιναν **άλλη απάντηση** στο ίδιο όνομα
 * (`UserTable` · `CustomerInfoCompact` · `UnifiedCustomerCard`). Έγιναν καταναλωτές.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΑΝΑΓΡΑΦΤΗΚΕ ΤΟ ΣΩΜΑ — ΔΥΟ ΜΕΤΡΗΜΕΝΑ ΕΛΑΤΤΩΜΑΤΑ, ΟΧΙ ΚΑΛΛΩΠΙΣΜΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η παλιά γραφή ήταν `split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)`:
 *
 * 1. 🔴 **`"Παπαδόπουλος & Υιοί ΟΕ"` → `"Π&"`** — το **εμπορικό «και»** ως σήμα
 *    μάρκας. Το `split(' ')` δεν ξέρει τι είναι γράμμα, και τα ελληνικά εταιρικά
 *    επιθήματα *(«& Υιοί», «Α.Ε.», «Ο.Ε.»)* είναι **ο κανόνας**, όχι η εξαίρεση.
 * 2. 🔴 **`"Παπαδόπουλος"` → `"Π"`** — **ένα** γράμμα, ενώ το `UserTable` έδινε
 *    **δύο**. Σε σήμα ταυτότητας το ένα γράμμα **συγκρούεται** για κάθε
 *    Παπαδόπουλο, Παπαδάκη και Παύλου· η διάκριση είναι όλη η δουλειά του.
 *
 * ⚠️ **Η ενοποίηση διάλεξε τη συμπεριφορά του `UserTable` (δύο γράμματα)**, γιατί
 * ήταν η **μόνη** από τις τέσσερις που είχε σκεφτεί τη μονολεκτική περίπτωση. Οι
 * κάρτες πελάτη δείχνουν πλέον `ΠΑ` εκεί που έδειχναν `Π` — **ορατή αλλαγή, και
 * σκόπιμη**.
 *
 * 🔑 **ΤΑ ΤΟΝΙΚΑ ΣΗΜΑΔΙΑ ΠΕΦΤΟΥΝ** — δεν είναι λεπτομέρεια Unicode, είναι **ελληνική
 * τυπογραφία**: στα κεφαλαία ο μονοτονικός τόνος **δεν γράφεται**. Το
 * `'ά'.toUpperCase()` της JS δίνει `'Ά'`, οπότε χωρίς αυτό το βήμα το σήμα του
 * «Άλφα Τεχνική» θα διάβαζε **`ΆΤ`** — λάθος που κάθε Έλληνας βλέπει αμέσως.
 */
export function getInitials(name: string): string {
  // `\p{L}+` = «συστάδες γραμμάτων», άρα στίξη, ψηφία και το «&» **δεν υπάρχουν
  // ποτέ** ως υποψήφια. Το `split(' ')` τα έβλεπε ως λέξεις.
  const words = (name || '').match(/\p{L}+/gu);
  if (words === null) return '';

  const picked = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`;

  return picked
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .normalize('NFC');
}

export function getContactInitials(contact: Contact): string {
  return getInitials(getContactDisplayName(contact));
}

export function getPrimaryEmail(contact: Contact): string | undefined {
  // Try standard structure first (Individual, Company with emails array)
  const emails = contact.emails || [];
  const primaryEmail = emails.find(e => e.isPrimary);
  const standardEmail = primaryEmail?.email || emails[0]?.email;

  if (standardEmail) {
    return standardEmail;
  }

  // 🏛️ SERVICE CONTACT: Try service-specific legacy fields with type safety
  if (hasLegacyServiceFields(contact)) {
    return contact.email ||
           contact.contactEmail ||
           contact.officialEmail ||
           undefined;
  }

  return undefined;
}

export function getPrimaryPhone(contact: Contact): string | undefined {
  // Try standard structure first (Individual, Company with phones array)
  const phones = contact.phones || [];
  const primaryPhone = phones.find(p => p.isPrimary);
  const standardPhone = primaryPhone?.number || phones[0]?.number;

  if (standardPhone) {
    return standardPhone;
  }

  // 🏛️ SERVICE CONTACT: Try service-specific legacy fields with type safety
  if (hasLegacyServiceFields(contact)) {
    return contact.phone ||
           contact.telephone ||
           contact.centralPhone ||
           undefined;
  }

  return undefined;
}

export function getPrimaryAddress(contact: Contact): AddressInfo | undefined {
  const addresses = contact.addresses || [];
  const primaryAddress = addresses.find(a => a.isPrimary);
  return primaryAddress || addresses[0];
}

// =============================================================================
// 🏢 ENTERPRISE: Sale Readiness Rules — SSoT for buyer validation
// =============================================================================

/** Enterprise sale readiness rules — SSoT for buyer validation */
export const saleReadinessRules = {
  reserve: {
    individual: { requireName: true, requireContact: false, requireVat: false },
    company:    { requireName: true, requireContact: false, requireVat: false },
  },
  sell: {
    individual: { requireName: true, requireContact: true, requireVat: false },
    company:    { requireName: true, requireContact: true, requireVat: true },
  },
} as const;

export type CommercialTransactionType = keyof typeof saleReadinessRules;

interface SaleReadinessResult {
  valid: boolean;
  missingFields: string[];
}

/**
 * Validate a contact's readiness for a commercial transaction (reserve/sell).
 * Uses centralized saleReadinessRules as SSoT.
 */
export function validateContactForSale(
  contact: Contact,
  transactionType: CommercialTransactionType
): SaleReadinessResult {
  const missingFields: string[] = [];

  // Service contacts can never be buyers
  if (isServiceContact(contact)) {
    return { valid: false, missingFields: ['serviceContactNotAllowed'] };
  }

  const contactCategory = isCompanyContact(contact) ? 'company' : 'individual';
  const rules = saleReadinessRules[transactionType][contactCategory];

  // Check name
  if (rules.requireName) {
    const displayName = getContactDisplayName(contact);
    if (!displayName || displayName.trim().length === 0) {
      missingFields.push('name');
    }
  }

  // Check contact info (email OR phone)
  if (rules.requireContact) {
    const hasEmail = !!getPrimaryEmail(contact);
    const hasPhone = !!getPrimaryPhone(contact);
    if (!hasEmail && !hasPhone) {
      missingFields.push('emailOrPhone');
    }
  }

  // Check VAT number (companies only on sell)
  if (rules.requireVat) {
    if (isCompanyContact(contact) && !contact.vatNumber) {
      missingFields.push('vatNumber');
    }
  }

  return { valid: missingFields.length === 0, missingFields };
}

// Re-export type guards to be available from the barrel file
export { isIndividualContact, isCompanyContact, isServiceContact };
