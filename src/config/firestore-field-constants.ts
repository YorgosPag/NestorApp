/**
 * 🏢 ENTERPRISE FIRESTORE FIELD NAME CONSTANTS
 *
 * Single source of truth για τα πιο χρησιμοποιημένα Firestore field names.
 * Αποτρέπει typo bugs σε .where() και .orderBy() κλήσεις.
 *
 * ADR-245B: Hardcoded Strings Audit — Phase B
 *
 * COVERAGE: Top 14 fields → ~80% of all .where()/.orderBy() calls
 *
 * @module config/firestore-field-constants
 */

// ============================================================================
// CORE QUERY FIELDS — Used in .where() and .orderBy() clauses
// ============================================================================

/**
 * Firestore field name constants for type-safe queries.
 *
 * Usage:
 * ```typescript
 * import { FIELDS } from '@/config/firestore-field-constants';
 *
 * // Before: .where('companyId', '==', id)  — typo risk
 * // After:  .where(FIELDS.COMPANY_ID, '==', id)  — compile-time safe
 * ```
 */
export const FIELDS = {
  // 🏢 OWNERSHIP & TENANT ISOLATION
  COMPANY_ID: 'companyId',

  // 📊 STATUS & STATE
  STATUS: 'status',

  // 🏗️ ENTITY REFERENCES (foreign keys)
  BUILDING_ID: 'buildingId',
  PROJECT_ID: 'projectId',
  CONTACT_ID: 'contactId',
  PROPERTY_ID: 'propertyId',
  FLOOR_ID: 'floorId',
  ENTITY_TYPE: 'entityType',
  ENTITY_ID: 'entityId',

  // 📋 GENERIC CLASSIFICATION
  TYPE: 'type',

  // 👤 AUDIT TRAIL FIELDS
  CREATED_BY: 'createdBy',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',

  // 🗑️ SOFT DELETE
  IS_DELETED: 'isDeleted',
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Union of all registered field name values */
export type FieldName = typeof FIELDS[keyof typeof FIELDS];

/** Key name in the FIELDS registry */
export type FieldKey = keyof typeof FIELDS;
