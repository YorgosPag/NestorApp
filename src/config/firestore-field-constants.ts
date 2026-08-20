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
   * ADR-777 Α9/Α14 — το πεδίο απομόνωσης του `property_demands` **και** του
   * `owner_properties` (§8.33: το δεύτερο λεγόταν `ownerUserId` μέχρι να αποκτήσει η
   * προσφορά **εντολή**· από τη στιγμή που γράφει και ο μεσίτης, «κάτοχος» θα σήμαινε
   * τον υπάλληλο του γραφείου).
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
   * ADR-777 Α9/Α14 — η εταιρεία υπό την οποία ενήργησε ο συντάκτης.
   *
   * ⚠️ **ΑΠΟΔΟΣΗ, ΟΧΙ ΑΠΟΜΟΝΩΣΗ** — και ο διαχωρισμός είναι ο λόγος που ζει εδώ ως
   * ξεχωριστό όνομα. Το `tenant-config.ts` γράφει ρητά ότι *«δύο άξονες απομόνωσης
   * για ένα έγγραφο σημαίνει **δύο απαντήσεις** στο “ποιος το βλέπει;”»*. Αυτό απαντά
   * **άλλη** ερώτηση: *ποιο γραφείο το κατέγραψε* — ώστε ο κατάλογος του γραφείου να
   * επιβιώνει όταν ο υπάλληλος φύγει (ο κανόνας της ίδιας της αγοράς: *«listings
   * belong to the **broker**, not the agent»*).
   */
  AUTHOR_COMPANY_ID: 'authorCompanyId',

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
