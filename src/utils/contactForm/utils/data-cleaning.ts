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