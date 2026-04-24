// ============================================================================
// 🏢 ENTERPRISE DATE TYPES - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ TYPES
// ============================================================================
//
// 🎯 PURPOSE: Type-safe date handling για όλη την εφαρμογή
// 🔗 USED BY: Contact relationships, events, timestamps, Firebase data
// 🏢 STANDARDS: Enterprise-grade date type safety, Firebase compatibility
//
// ============================================================================

/**
 * 📅 ENTERPRISE: Flexible Date Input Types
 *
 * Type-safe union για όλους τους τρόπους που μπορεί να έρθει date στην εφαρμογή:
 * - Native Date objects
 * - ISO 8601 strings
 * - Unix timestamps (seconds ή milliseconds)
 * - Firebase Firestore Timestamps
 * - null/undefined για optional dates
 */
export type FlexibleDateInput =
  | Date                    // Native Date object
  | string                  // ISO 8601 string "2024-12-11T10:00:00Z"
  | number                  // Unix timestamp (ms ή seconds)
  | FirebaseTimestamp       // Firebase Firestore timestamp (full: seconds + nanoseconds)
  | { toDate: () => Date }  // Firestore Timestamp (toDate-only pattern — FirestoreishTimestamp compat)
  | null                    // Explicit null
  | undefined;              // Optional/missing dates

/**
 * 🔥 Firebase Firestore Timestamp Interface
 *
 * Type-safe interface για Firebase timestamps που έρχονται από Firestore.
 * Αποφεύγουμε dependency στο Firebase SDK για pure typing.
 */
export interface FirebaseTimestamp {
  /** Unix timestamp in seconds */
  seconds: number;
  /** Additional nanoseconds */
  nanoseconds: number;
  /** Method to convert to Date */
  toDate?: () => Date;
}

// ============================================================================
// CONVENIENCE TYPE EXPORTS
// ============================================================================
/** Common date input για contact timestamps */
export type ContactTimestamp = FlexibleDateInput;