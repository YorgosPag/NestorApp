// ============================================================================
// ARRAY CREATION EXTRACTORS - ENTERPRISE MODULE
// ============================================================================
//
// 📋 Array creation utilities for email and phone fields
// Transforms form string fields into structured Contact model arrays
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

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
  type: 'mobile' | 'work' | 'home' | 'fax';
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
 * @param phoneType - Phone type ('mobile' | 'work')
 * @returns Phones array in Contact model format
 */
export function createPhonesArray(phone: string, phoneType: 'mobile' | 'work' = 'mobile'): PhoneEntry[] {
  return phone ? [{ number: phone, type: phoneType, isPrimary: true }] : [];
}