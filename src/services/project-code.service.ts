/**
 * 🏢 ENTERPRISE PROJECT CODE SERVICE
 *
 * Generates sequential, human-readable project codes (PRJ-001, PRJ-002, etc.)
 * using Firestore atomic transactions for concurrency safety.
 *
 * ARCHITECTURE DECISION:
 * - This service handles BUSINESS/DISPLAY codes (human-readable)
 * - enterprise-id.service.ts handles TECHNICAL IDs (UUIDs)
 * - These are complementary, NOT duplicates (Single Responsibility Principle)
 *
 * ENTERPRISE STANDARDS:
 * - Atomic counter with Firestore transactions
 * - Zero collision guarantee
 * - Configurable prefix and padding via centralized constants
 * - Full audit trail support
 *
 * @author Enterprise Architecture Team
 * @date 2026-01-10
 * @version 1.0.0
 */

import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// CONFIGURATION (Centralized - NO hardcoded values)
// ============================================================================

/**
 * Project code configuration
 * All values are centralized here for easy modification
 */
export const PROJECT_CODE_CONFIG = {
  /** Prefix for project codes */
  PREFIX: process.env.NEXT_PUBLIC_PROJECT_CODE_PREFIX || 'PRJ',

  /** Separator between prefix and number */
  SEPARATOR: process.env.NEXT_PUBLIC_PROJECT_CODE_SEPARATOR || '-',

  /** Number of digits to pad (e.g., 3 = 001, 002, etc.) */
  PADDING: parseInt(process.env.NEXT_PUBLIC_PROJECT_CODE_PADDING || '3', 10),

  /** Counter document name within counters collection */
  COUNTER_DOC: process.env.NEXT_PUBLIC_PROJECT_COUNTER_DOC || 'projects',

  /** Initial counter value (first project will be this + 1) */
  INITIAL_VALUE: 0,

  /** Maximum retry attempts for transaction conflicts */
  MAX_RETRIES: 5
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Counter document structure in Firestore
 */
export interface CounterDocument {
  /** Next available number */
  next: number;
  /** Last update timestamp */
  updatedAt: Date;
  /** Total codes generated (for audit) */
  totalGenerated: number;
}

/**
 * Result of project code generation
 */
export interface ProjectCodeResult {
  /** The generated code (e.g., "PRJ-001") */
  code: string;
  /** The numeric sequence value */
  sequence: number;
  /** Timestamp of generation */
  generatedAt: Date;
}

/**
 * Firestore transaction interface (server-side)
 */
interface FirestoreTransaction {
  get: (docRef: FirestoreDocumentReference) => Promise<FirestoreDocumentSnapshot>;
  set: (docRef: FirestoreDocumentReference, data: Record<string, unknown>) => void;
  update: (docRef: FirestoreDocumentReference, data: Record<string, unknown>) => void;
}

/**
 * Firestore document reference interface
 */
interface FirestoreDocumentReference {
  id: string;
}

/**
 * Firestore document snapshot interface
 */
interface FirestoreDocumentSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

/**
 * Firestore database interface
 */
interface FirestoreDatabase {
  collection: (name: string) => {
    doc: (id: string) => FirestoreDocumentReference;
  };
  runTransaction: <T>(fn: (transaction: FirestoreTransaction) => Promise<T>) => Promise<T>;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * 🏢 PROJECT CODE SERVICE
 *
 * Enterprise-grade sequential code generation with atomic transactions
 */
export class ProjectCodeService {
  private readonly config = PROJECT_CODE_CONFIG;

  /**
   * Format a number into a padded project code
   * @param sequence - The numeric sequence (e.g., 1)
   * @returns Formatted code (e.g., "PRJ-001")
   */
  formatCode(sequence: number): string {
    const paddedNumber = sequence.toString().padStart(this.config.PADDING, '0');
    return `${this.config.PREFIX}${this.config.SEPARATOR}${paddedNumber}`;
  }

  /**
   * Parse a project code back to its sequence number
   * @param code - The project code (e.g., "PRJ-001")
   * @returns The sequence number or null if invalid
   */
  parseCode(code: string): number | null {
    const pattern = new RegExp(
      `^${this.config.PREFIX}${this.config.SEPARATOR}(\\d{${this.config.PADDING},})$`
    );
    const match = code.match(pattern);

    if (!match || !match[1]) {
      return null;
    }

    return parseInt(match[1], 10);
  }

  /**
   * Validate if a string is a valid project code format
   * @param code - The code to validate
   * @returns True if valid format
   */
  isValidCode(code: string): boolean {
    return this.parseCode(code) !== null;
  }

  /**
   * Generate the next project code using Firestore transaction
   * This is the main method - MUST be called server-side only
   *
   * @param db - Firestore database instance (from firebase-admin)
   * @returns ProjectCodeResult with the new code
   * @throws Error if transaction fails after max retries
   */
  async generateNextCode(db: FirestoreDatabase): Promise<ProjectCodeResult> {
    const counterRef = db
      .collection(COLLECTIONS.COUNTERS)
      .doc(this.config.COUNTER_DOC);

    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const now = new Date();

      let nextValue: number;
      let totalGenerated: number;

      if (!counterDoc.exists) {
        // First time - initialize counter
        nextValue = this.config.INITIAL_VALUE + 1;
        totalGenerated = 1;

        transaction.set(counterRef, {
          next: nextValue + 1, // Prepare for next call
          updatedAt: now,
          totalGenerated,
          createdAt: now
        });
      } else {
        // Increment existing counter
        const data = counterDoc.data();
        const currentNext = (data?.next as number) ?? this.config.INITIAL_VALUE + 1;
        const currentTotal = (data?.totalGenerated as number) ?? 0;

        nextValue = currentNext;
        totalGenerated = currentTotal + 1;

        transaction.update(counterRef, {
          next: nextValue + 1,
          updatedAt: now,
          totalGenerated
        });
      }

      return {
        code: this.formatCode(nextValue),
        sequence: nextValue,
        generatedAt: now
      };
    });

    return result;
  }

  /**
   * Get current counter state without incrementing
   * Useful for admin/debugging purposes
   *
   * @param db - Firestore database instance
   * @returns Current counter state or null if not initialized
   */
  async getCurrentState(db: FirestoreDatabase): Promise<CounterDocument | null> {
    const counterRef = db
      .collection(COLLECTIONS.COUNTERS)
      .doc(this.config.COUNTER_DOC);

    // We need to use a transaction just to read for type safety
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }

      return {
        next: (data.next as number) ?? 0,
        updatedAt: (data.updatedAt as Date) ?? new Date(),
        totalGenerated: (data.totalGenerated as number) ?? 0
      };
    });

    return result;
  }

  /**
   * Initialize or reset the counter to a specific value
   * USE WITH CAUTION - Only for migration/admin purposes
   *
   * @param db - Firestore database instance
   * @param startFrom - The value to start from (next code will be startFrom + 1)
   * @returns The initialized state
   */
  async initializeCounter(
    db: FirestoreDatabase,
    startFrom: number = this.config.INITIAL_VALUE
  ): Promise<CounterDocument> {
    const counterRef = db
      .collection(COLLECTIONS.COUNTERS)
      .doc(this.config.COUNTER_DOC);

    const now = new Date();
    const state: CounterDocument = {
      next: startFrom + 1,
      updatedAt: now,
      totalGenerated: startFrom
    };

    await db.runTransaction(async (transaction) => {
      transaction.set(counterRef, {
        ...state,
        createdAt: now,
        initializedBy: 'ProjectCodeService.initializeCounter'
      });
    });

    return state;
  }

  /**
   * Batch generate multiple codes
   * More efficient than calling generateNextCode multiple times
   *
   * @param db - Firestore database instance
   * @param count - Number of codes to generate
   * @returns Array of ProjectCodeResults
   */
  async generateBatchCodes(
    db: FirestoreDatabase,
    count: number
  ): Promise<ProjectCodeResult[]> {
    if (count <= 0) {
      return [];
    }

    const counterRef = db
      .collection(COLLECTIONS.COUNTERS)
      .doc(this.config.COUNTER_DOC);

    const results = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const now = new Date();

      let startValue: number;
      let currentTotal: number;

      if (!counterDoc.exists) {
        startValue = this.config.INITIAL_VALUE + 1;
        currentTotal = 0;
      } else {
        const data = counterDoc.data();
        startValue = (data?.next as number) ?? this.config.INITIAL_VALUE + 1;
        currentTotal = (data?.totalGenerated as number) ?? 0;
      }

      // Generate all codes
      const codes: ProjectCodeResult[] = [];
      for (let i = 0; i < count; i++) {
        const sequence = startValue + i;
        codes.push({
          code: this.formatCode(sequence),
          sequence,
          generatedAt: now
        });
      }

      // Update counter
      const newNext = startValue + count;
      const newTotal = currentTotal + count;

      if (!counterDoc.exists) {
        transaction.set(counterRef, {
          next: newNext,
          updatedAt: now,
          totalGenerated: newTotal,
          createdAt: now
        });
      } else {
        transaction.update(counterRef, {
          next: newNext,
          updatedAt: now,
          totalGenerated: newTotal
        });
      }

      return codes;
    });

    return results;
  }

  /**
   * Get configuration (for debugging/admin)
   */
  getConfig(): typeof PROJECT_CODE_CONFIG {
    return { ...this.config };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global project code service instance
 */
export const projectCodeService = new ProjectCodeService();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Format a sequence number into a project code
 */
export const formatProjectCode = (sequence: number): string =>
  projectCodeService.formatCode(sequence);

/**
 * Parse a project code to extract sequence number
 */
export const parseProjectCode = (code: string): number | null =>
  projectCodeService.parseCode(code);

/**
 * Validate project code format
 */
export const isValidProjectCode = (code: string): boolean =>
  projectCodeService.isValidCode(code);

/**
 * Default export
 */
export default projectCodeService;
