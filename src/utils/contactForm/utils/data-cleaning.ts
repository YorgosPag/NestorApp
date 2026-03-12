// ============================================================================
// DATA CLEANING UTILITIES - ENTERPRISE MODULE
// ============================================================================
//
// 🧹 Data cleaning and sanitization utilities for form data processing
// Specialized functions for handling undefined/null values and URL detection
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import { isValidEmail } from '@/lib/validation/email-validation';
import { isValidPhone } from '@/lib/validation/phone-validation';

// 🏢 ENTERPRISE: i18n support for validation messages
import i18n from '@/i18n/config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('DataCleaning');

// 🏢 ENTERPRISE: Helper function to get translated validation message
const t = (key: string): string => {
  return i18n.t(`validation.${key}`, { ns: 'contacts' });
};

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/**
 * Contact data types for cleaning/sanitization
 * 🏢 ENTERPRISE: Using interface to avoid circular reference
 */
export interface ContactDataRecord {
  [key: string]: ContactDataValue;
}

export type ContactDataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | ContactDataValue[]
  | ContactDataRecord;

/** Validation result type */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 🏢 ENTERPRISE: Detect if URL is Firebase Storage URL
 */
export function isFirebaseStorageURL(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  return url.includes('firebasestorage.googleapis.com') || url.includes('appspot.com');
}

/**
 * 🏢 ENTERPRISE: Detect if URL requires special deletion handling
 */
export function requiresSpecialDeletion(key: string, value: ContactDataValue): boolean {
  // Always preserve photoURL fields (Base64 or Firebase Storage)
  if (key === 'photoURL') return true;

  // 🏢 ENTERPRISE FIX: Always preserve logoURL fields for company logo deletion
  if (key === 'logoURL') return true;

  // Always preserve multiplePhotoURLs arrays (even empty for deletion)
  if (key === 'multiplePhotoURLs') return true;

  // Preserve Firebase Storage URLs for proper cleanup
  if (typeof value === 'string' && isFirebaseStorageURL(value)) return true;

  return false;
}

/**
 * Clean undefined/null/empty values from object
 *
 * ⚠️ ΚΡΙΣΙΜΗ ΣΗΜΕΙΩΣΗ: Αυτή η function ήταν η αιτία του bug με τις φωτογραφίες!
 * ΜΗ ΑΛΛΑΞΕΙΣ την συμπεριφορά του multiplePhotoURLs - παίζουμε πάνω από 1 ημέρα!
 *
 * 🚀 ENTERPRISE UPGRADE (2025-12-04): Τώρα υποστηρίζει Firebase Storage URLs!
 *
 * @param obj - Object to clean
 * @returns Cleaned object
 */
export function cleanUndefinedValues<T extends object>(obj: T): T {
  const cleaned: ContactDataRecord = {};

  Object.keys(obj).forEach(key => {
    const value = (obj as Record<string, ContactDataValue>)[key];

    // 🚨🚨🚨 ΜΕΓΑΛΗ ΠΡΟΣΟΧΗ - ΜΗ ΑΓΓΙΖΕΙΣ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ! 🚨🚨🚨
    // 🔥 CRITICAL FIX: Preserve empty strings για photoURL deletion
    // ΠΡΟΒΛΗΜΑ: Κενά strings αφαιρούνταν από το cleanUndefinedValues
    // ΛΥΣΗ: Preserve κενά strings για photoURL ώστε να διαγράφεται από τη βάση
    //
    // ⚠️ ΙΣΤΟΡΙΚΟ DEBUGGING: 2025-12-04 - Έκανε 6+ ώρες debugging!
    // ⚠️ ΑΝ ΑΦΑΙΡΕΣΕΙΣ ΤΟ `|| key === 'photoURL'` → οι φωτογραφίες ΔΕΝ θα διαγράφονται!
    // ⚠️ ΤΟ ΠΡΟΒΛΗΜΑ ΗΤΑΝ: photoURL: '' → γινόταν undefined → δεν έφτανε στη Firebase
    // ⚠️ Η ΛΥΣΗ: Εξαίρεση για photoURL ώστε κενά strings να περνάνε στη βάση
    //
    // 🚀 ENTERPRISE UPGRADE (2025-12-04): Τώρα υποστηρίζει και Firebase Storage URLs!
    // 🚨 ΜΗ ΑΛΛΑΞΕΙΣ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ - TESTED & WORKING! 🚨
    if (value !== undefined && value !== null && (value !== '' || requiresSpecialDeletion(key, value))) {
      if (Array.isArray(value)) {
        // 🚨 CRITICAL FIX - ΜΗ ΑΓΓΙΖΕΙΣ ΑΥΤΟΝ ΤΟΝ ΚΩΔΙΚΑ! 🚨
        // ΠΡΟΒΛΗΜΑ: Πριν από αυτή τη διόρθωση, τα κενά arrays δεν έφταναν στη βάση
        // ΛΥΣΗ: Preserve empty arrays για multiplePhotoURLs ώστε η Firebase να διαγράφει
        // TESTED: 2025-12-04 - Λύθηκε μετά από 5+ ώρες debugging
        // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preserve empty arrays για proper database deletion
        // Ειδικά για multiplePhotoURLs, πρέπει να στέλνουμε [] για διαγραφή
        if (key === 'multiplePhotoURLs' || value.length > 0) {
          cleaned[key] = value;
          if (key === 'multiplePhotoURLs' && value.length === 0) {
            logger.info(' DATA CLEANING: Preserving empty multiplePhotoURLs array for database deletion');
          }
        }
      } else if (typeof value === 'object' && !(value instanceof Date)) {
        // 🏢 ENTERPRISE: Exclude Date objects from recursive cleaning
        const cleanedNestedObj = cleanUndefinedValues(value as ContactDataRecord);
        if (Object.keys(cleanedNestedObj).length > 0) {
          cleaned[key] = cleanedNestedObj;
        }
      } else if (value instanceof Date) {
        // 🏢 ENTERPRISE: Preserve Date objects as-is
        cleaned[key] = value;
      } else {
        cleaned[key] = value;
        // 🛠️ DEBUG: Log preservation of photoURL empty strings
        if (key === 'photoURL' && value === '') {
          logger.info(' DATA CLEANING: Preserving empty photoURL string for database deletion');
        }
      }
    }
  });

  return cleaned as T;
}

// ============================================================================
// 🏢 ENTERPRISE CONTACT DATA SANITIZATION SYSTEM
// ============================================================================

/**
 * 🏢 ENTERPRISE: Contact Data Sanitizer με intelligent field processing
 *
 * Αυτή η function αντιμετωπίζει το core πρόβλημα: πεδία αποθηκεύονται ως κενά
 * strings ("") αντί να αφαιρούνται ή να έχουν proper default values.
 *
 * @param contactData - Contact object πριν την αποθήκευση στη βάση
 * @returns Sanitized contact object με cleaned fields
 */
export function sanitizeContactData(contactData: ContactDataRecord): ContactDataRecord {
  logger.info('ENTERPRISE SANITIZER: Starting contact data sanitization...');

  const sanitized = { ...contactData };

  // 📊 Στατιστικά για debugging
  let emptyFieldsRemoved = 0;
  let fieldsWithDefaults = 0;

  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];

    // 🚨 ΚΡΙΣΙΜΑ ΠΕΔΙΑ: Δεν αγγίζουμε ποτέ!
    if (requiresSpecialDeletion(key, value)) {
      logger.info(` SANITIZER: Preserving critical field "${key}" (special handling)`);
      return;
    }

    // 🧹 ΚΕΝΑ STRINGS: Αφαίρεση κενών strings που δεν προσφέρουν τιμή
    if (typeof value === 'string' && value.trim() === '') {
      logger.info(` SANITIZER: Removing empty string field "${key}"`);
      delete sanitized[key];
      emptyFieldsRemoved++;
      return;
    }

    // 🔄 ARRAYS: Καθαρισμός κενών arrays (εκτός από τα critical)
    if (Array.isArray(value) && value.length === 0 && !requiresSpecialDeletion(key, value)) {
      logger.info(` SANITIZER: Removing empty array field "${key}"`);
      delete sanitized[key];
      emptyFieldsRemoved++;
      return;
    }

    // 📧 INTELLIGENT DEFAULTS: Εφαρμογή smart defaults για specific fields
    if (key === 'emails' && (!value || !Array.isArray(value) || value.length === 0)) {
      // Εάν υπάρχει email field, δημιούργησε emails array
      if (sanitized.email && typeof sanitized.email === 'string' && sanitized.email.trim()) {
        sanitized.emails = [{
          email: sanitized.email.trim(),
          type: 'personal' as const,
          isPrimary: true
        }];
        fieldsWithDefaults++;
        logger.info(` SANITIZER: Created emails array from email field`);
      }
    }

    // 📞 PHONE DEFAULTS: Παρόμοια λογική για τηλέφωνα
    if (key === 'phones' && (!value || !Array.isArray(value) || value.length === 0)) {
      if (sanitized.phone && typeof sanitized.phone === 'string' && sanitized.phone.trim()) {
        sanitized.phones = [{
          number: sanitized.phone.trim(),
          type: 'mobile' as const,
          isPrimary: true
        }];
        fieldsWithDefaults++;
        logger.info(` SANITIZER: Created phones array from phone field`);
      }
    }

    // 🗂️ NESTED OBJECTS: Recursive sanitization (excluding Date objects)
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      const nestedSanitized = sanitizeContactData(value as ContactDataRecord);
      if (Object.keys(nestedSanitized).length === 0) {
        logger.info(` SANITIZER: Removing empty object field "${key}"`);
        delete sanitized[key];
        emptyFieldsRemoved++;
      } else {
        sanitized[key] = nestedSanitized;
      }
    }
  });

  // 🎯 ENTERPRISE TIMESTAMPS: Διασφαλίζουμε proper timestamps
  if (!sanitized.createdAt) {
    // Η Firebase θα το θέσει με serverTimestamp(), δεν κάνουμε τίποτα
    logger.info('SANITIZER: createdAt will be set by Firebase serverTimestamp()');
  }

  if (!sanitized.updatedAt) {
    // Η Firebase θα το θέσει με serverTimestamp(), δεν κάνουμε τίποτα
    logger.info('SANITIZER: updatedAt will be set by Firebase serverTimestamp()');
  }

  // 📊 ΑΝΑΦΟΡΑ ΕΠΕΞΕΡΓΑΣΙΑΣ
  logger.info('ENTERPRISE SANITIZER: Contact sanitization completed', {
    originalFieldsCount: Object.keys(contactData).length,
    sanitizedFieldsCount: Object.keys(sanitized).length,
    emptyFieldsRemoved,
    fieldsWithDefaults,
    contactType: sanitized.type,
    contactId: sanitized.id || 'new'
  });

  return sanitized;
}

/**
 * 🏢 ENTERPRISE: Contact Field Validator με comprehensive checks
 *
 * Validates required fields based on contact type και ensures data integrity
 *
 * @param contactData - Contact object to validate
 * @returns Validation result με errors array
 */
export function validateContactData(contactData: ContactDataRecord): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 🚨 REQUIRED FIELDS VALIDATION
  if (!contactData.type) {
    errors.push(t('contactTypeRequired'));
  }

  // 🏢 ENTERPRISE: Helper for safe string trim with type guard
  const safeStringTrim = (value: ContactDataValue): string => {
    return typeof value === 'string' ? value.trim() : '';
  };

  switch (contactData.type) {
    case 'individual':
      if (!contactData.firstName || safeStringTrim(contactData.firstName) === '') {
        errors.push(t('individual.firstNameRequired'));
      }
      if (!contactData.lastName || safeStringTrim(contactData.lastName) === '') {
        errors.push(t('individual.lastNameRequired'));
      }
      break;

    case 'company':
      if (!contactData.companyName || safeStringTrim(contactData.companyName) === '') {
        errors.push(t('company.nameRequired'));
      }
      if (!contactData.vatNumber || safeStringTrim(contactData.vatNumber) === '') {
        warnings.push(t('company.vatRecommended'));
      }
      break;

    case 'service':
      if (!contactData.serviceName || safeStringTrim(contactData.serviceName) === '') {
        errors.push(t('service.nameRequired'));
      }
      if (!contactData.serviceType || safeStringTrim(contactData.serviceType) === '') {
        errors.push(t('service.typeRequired'));
      }
      break;
  }

  // 📧 EMAIL VALIDATION — ADR-209: centralized
  if (contactData.email && typeof contactData.email === 'string') {
    if (!isValidEmail(contactData.email)) {
      errors.push(t('email.invalid'));
    }
  }

  // 📞 PHONE VALIDATION — ADR-212: centralized
  if (contactData.phone && typeof contactData.phone === 'string') {
    if (!isValidPhone(contactData.phone)) {
      warnings.push(t('phone.invalidFormat'));
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
