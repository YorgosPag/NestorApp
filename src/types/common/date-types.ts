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

/**
 * ⏰ ENTERPRISE: Date Formatting Options
 *
 * Κεντρικοποιημένες επιλογές για consistent date formatting
 */
export interface DateFormatOptions {
  /** Include time component */
  includeTime?: boolean;
  /** Use relative dates ("πριν από 2 ώρες") */
  useRelative?: boolean;
  /** Greek locale formatting */
  useGreekLocale?: boolean;
  /** Custom format string */
  customFormat?: string;
  /** Fallback text for invalid dates */
  fallbackText?: string;
}

/**
 * 🎯 ENTERPRISE: Date Validation Result
 *
 * Type-safe result για date validation με error handling
 */
export interface DateValidationResult {
  /** Is the date valid? */
  isValid: boolean;
  /** Parsed Date object (if valid) */
  date?: Date;
  /** Error message (if invalid) */
  error?: string;
  /** Original input value */
  originalInput: FlexibleDateInput;
}

// ============================================================================
// CONVENIENCE TYPE EXPORTS
// ============================================================================

/** Common date input για relationship creation dates */
export type RelationshipDate = FlexibleDateInput;

/** Common date input για contact timestamps */
export type ContactTimestamp = FlexibleDateInput;

/** Common date input για event dates */
export type EventDate = FlexibleDateInput;