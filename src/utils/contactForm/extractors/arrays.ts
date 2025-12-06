// ============================================================================
// ARRAY CREATION EXTRACTORS - ENTERPRISE MODULE
// ============================================================================
//
// 📋 Array creation utilities for email and phone fields
// Transforms form string fields into structured Contact model arrays
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

/**
 * Create emails array from form email field
 *
 * @param email - Email string from form
 * @returns Emails array in Contact model format
 */
export function createEmailsArray(email: string): any[] {
  return email ? [{ email, type: 'work', isPrimary: true }] : [];
}

/**
 * Create phones array from form phone field
 *
 * @param phone - Phone string from form
 * @param phoneType - Phone type ('mobile' | 'work')
 * @returns Phones array in Contact model format
 */
export function createPhonesArray(phone: string, phoneType: 'mobile' | 'work' = 'mobile'): any[] {
  return phone ? [{ number: phone, type: phoneType, isPrimary: true }] : [];
}