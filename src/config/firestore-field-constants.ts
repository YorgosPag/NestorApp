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
  /**
   * ADR-777 Α9 — το πεδίο απομόνωσης του `property_demands`.
   *
   * 🔑 **Δεύτερο πεδίο απομόνωσης, και είναι σκόπιμο.** Το `tenant-config.ts` το
   * δηλώνει `mode: 'userId'`: μια **ζήτηση ανήκει σε ΑΝΘΡΩΠΟ**, όχι σε εταιρεία —
   * όπως ήδη τα `NOTIFICATIONS`. Ζει εδώ γιατί το `FIELDS.*` είναι μία από τις
   * **τέσσερις** αυθεντίες που διαβάζει η CHECK 3.35· ένα χειρόγραφο
   * `'authorUserId'` στο ερώτημα θα ήταν **πέμπτη**, δηλαδή ακριβώς ο τύπος
   * απόκλισης που η πύλη υπάρχει για να πιάνει.
   */
  AUTHOR_USER_ID: 'authorUserId',
  /**
   * ADR-777 Α14 — το πεδίο απομόνωσης του `owner_properties`.
   *
   * 🔑 **Τρίτο πεδίο απομόνωσης, ξεχωριστό από το `AUTHOR_USER_ID` ΕΠΙΤΗΔΕΣ.** Θα
   * ήταν εύκολο να ξαναχρησιμοποιηθεί το ίδιο όνομα και θα ήταν **λάθος**: ο
   * «συντάκτης» μιας ζήτησης και ο **κάτοχος** ενός ακινήτου δεν είναι η ίδια σχέση.
   * Η Α9 κρατά ρητά `mandate: 'brokered'` — ζήτηση **γραμμένη από μεσίτη για
   * λογαριασμό άλλου** — οπότε «συντάκτης» εκεί σημαίνει *ποιος την έγραψε*. Εδώ η
   * σχέση είναι **κυριότητα**, και ένα κοινό όνομα θα έκανε τη μελλοντική ροή του
   * μεσίτη (δηλωμένο κενό, `types/owner-property.ts`) να μοιάζει ήδη λυμένη.
   *
   * ⚠️ Ζει εδώ γιατί το `FIELDS.*` είναι μία από τις **τέσσερις** αυθεντίες που
   * διαβάζει η CHECK 3.35· ένα χειρόγραφο `'ownerUserId'` στο ερώτημα θα ήταν
   * **πέμπτη**.
   */
  OWNER_USER_ID: 'ownerUserId',

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
