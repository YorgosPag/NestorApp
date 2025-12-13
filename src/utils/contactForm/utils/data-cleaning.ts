// ============================================================================
// DATA CLEANING UTILITIES - ENTERPRISE MODULE
// ============================================================================
//
// 🧹 Data cleaning and sanitization utilities for form data processing
// Specialized functions for handling undefined/null values and URL detection
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

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
export function requiresSpecialDeletion(key: string, value: any): boolean {
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
export function cleanUndefinedValues(obj: any): any {
  const cleaned: any = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];

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
            console.log('🛠️ DATA CLEANING: Preserving empty multiplePhotoURLs array for database deletion');
          }
        }
      } else if (typeof value === 'object') {
        const cleanedNestedObj = cleanUndefinedValues(value);
        if (Object.keys(cleanedNestedObj).length > 0) {
          cleaned[key] = cleanedNestedObj;
        }
      } else {
        cleaned[key] = value;
        // 🛠️ DEBUG: Log preservation of photoURL empty strings
        if (key === 'photoURL' && value === '') {
          console.log('🛠️ DATA CLEANING: Preserving empty photoURL string for database deletion');
        }
      }
    }
  });

  return cleaned;
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
export function sanitizeContactData(contactData: any): any {
  console.log('🧹 ENTERPRISE SANITIZER: Starting contact data sanitization...');

  const sanitized = { ...contactData };

  // 📊 Στατιστικά για debugging
  let emptyFieldsRemoved = 0;
  let fieldsWithDefaults = 0;

  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];

    // 🚨 ΚΡΙΣΙΜΑ ΠΕΔΙΑ: Δεν αγγίζουμε ποτέ!
    if (requiresSpecialDeletion(key, value)) {
      console.log(`🛡️ SANITIZER: Preserving critical field "${key}" (special handling)`);
      return;
    }

    // 🧹 ΚΕΝΑ STRINGS: Αφαίρεση κενών strings που δεν προσφέρουν τιμή
    if (typeof value === 'string' && value.trim() === '') {
      console.log(`🗑️ SANITIZER: Removing empty string field "${key}"`);
      delete sanitized[key];
      emptyFieldsRemoved++;
      return;
    }

    // 🔄 ARRAYS: Καθαρισμός κενών arrays (εκτός από τα critical)
    if (Array.isArray(value) && value.length === 0 && !requiresSpecialDeletion(key, value)) {
      console.log(`🗑️ SANITIZER: Removing empty array field "${key}"`);
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
        console.log(`🔧 SANITIZER: Created emails array from email field`);
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
        console.log(`🔧 SANITIZER: Created phones array from phone field`);
      }
    }

    // 🗂️ NESTED OBJECTS: Recursive sanitization
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedSanitized = sanitizeContactData(value);
      if (Object.keys(nestedSanitized).length === 0) {
        console.log(`🗑️ SANITIZER: Removing empty object field "${key}"`);
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
    console.log('⏰ SANITIZER: createdAt will be set by Firebase serverTimestamp()');
  }

  if (!sanitized.updatedAt) {
    // Η Firebase θα το θέσει με serverTimestamp(), δεν κάνουμε τίποτα
    console.log('⏰ SANITIZER: updatedAt will be set by Firebase serverTimestamp()');
  }

  // 📊 ΑΝΑΦΟΡΑ ΕΠΕΞΕΡΓΑΣΙΑΣ
  console.log('✅ ENTERPRISE SANITIZER: Contact sanitization completed', {
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
export function validateContactData(contactData: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 🚨 REQUIRED FIELDS VALIDATION
  if (!contactData.type) {
    errors.push('Contact type is required');
  }

  switch (contactData.type) {
    case 'individual':
      if (!contactData.firstName || contactData.firstName.trim() === '') {
        errors.push('Το όνομα είναι υποχρεωτικό για φυσικά πρόσωπα');
      }
      if (!contactData.lastName || contactData.lastName.trim() === '') {
        errors.push('Το επώνυμο είναι υποχρεωτικό για φυσικά πρόσωπα');
      }
      break;

    case 'company':
      if (!contactData.companyName || contactData.companyName.trim() === '') {
        errors.push('Το όνομα εταιρείας είναι υποχρεωτικό για νομικά πρόσωπα');
      }
      if (!contactData.vatNumber || contactData.vatNumber.trim() === '') {
        warnings.push('Το ΑΦΜ συνιστάται για νομικά πρόσωπα');
      }
      break;

    case 'service':
      if (!contactData.serviceName || contactData.serviceName.trim() === '') {
        errors.push('Το όνομα υπηρεσίας είναι υποχρεωτικό για δημόσιες υπηρεσίες');
      }
      if (!contactData.serviceType || contactData.serviceType.trim() === '') {
        errors.push('Ο τύπος υπηρεσίας είναι υποχρεωτικός για δημόσιες υπηρεσίες');
      }
      break;
  }

  // 📧 EMAIL VALIDATION
  if (contactData.email && typeof contactData.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactData.email)) {
      errors.push('Μη έγκυρη διεύθυνση email');
    }
  }

  // 📞 PHONE VALIDATION
  if (contactData.phone && typeof contactData.phone === 'string') {
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,15}$/;
    if (!phoneRegex.test(contactData.phone.replace(/\s/g, ''))) {
      warnings.push('Το τηλέφωνο μπορεί να έχει μη έγκυρο format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}