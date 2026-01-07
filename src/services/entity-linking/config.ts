/**
 * 🏢 ENTERPRISE: Entity Linking Configuration
 *
 * Single Source of Truth for entity relationship configuration.
 * ZERO hardcoded values - all values are centralized here.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Configuration-Driven Architecture (Bentley, Google)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { REALTIME_EVENTS } from '@/services/realtime';
import type { EntityLinkingConfig, EntityRelationship, EntityType } from './types';

// ============================================================================
// 🏢 ENTERPRISE: Relationship Configuration
// ============================================================================

/**
 * Centralized configuration for all entity relationships.
 * Each relationship defines:
 * - Which collection to update
 * - Which foreign key field to set
 * - Which event to dispatch on success
 * - Human-readable labels for UI
 */
export const ENTITY_LINKING_CONFIG: EntityLinkingConfig = {
  'project-company': {
    collection: COLLECTIONS.PROJECTS,
    foreignKey: 'companyId',
    successEvent: REALTIME_EVENTS.NAVIGATION_REFRESH,
    labels: {
      linkAction: 'Σύνδεση έργου με εταιρεία',
      unlinkAction: 'Αποσύνδεση έργου από εταιρεία',
      successMessage: 'Το έργο συνδέθηκε επιτυχώς με την εταιρεία!',
      errorMessage: 'Αποτυχία σύνδεσης έργου',
    },
  },

  'building-project': {
    collection: COLLECTIONS.BUILDINGS,
    foreignKey: 'projectId',
    successEvent: REALTIME_EVENTS.NAVIGATION_REFRESH,
    labels: {
      linkAction: 'Σύνδεση κτιρίου με έργο',
      unlinkAction: 'Αποσύνδεση κτιρίου από έργο',
      successMessage: 'Το κτίριο συνδέθηκε επιτυχώς με το έργο!',
      errorMessage: 'Αποτυχία σύνδεσης κτιρίου',
    },
  },

  'unit-building': {
    collection: COLLECTIONS.UNITS,
    foreignKey: 'buildingId',
    successEvent: REALTIME_EVENTS.UNIT_BUILDING_LINKED,
    labels: {
      linkAction: 'Σύνδεση μονάδας με κτίριο',
      unlinkAction: 'Αποσύνδεση μονάδας από κτίριο',
      successMessage: 'Η μονάδα συνδέθηκε επιτυχώς με το κτίριο!',
      errorMessage: 'Αποτυχία σύνδεσης μονάδας',
    },
  },

  'floor-building': {
    collection: COLLECTIONS.FLOORS,
    foreignKey: 'buildingId',
    successEvent: REALTIME_EVENTS.NAVIGATION_REFRESH,
    labels: {
      linkAction: 'Σύνδεση ορόφου με κτίριο',
      unlinkAction: 'Αποσύνδεση ορόφου από κτίριο',
      successMessage: 'Ο όροφος συνδέθηκε επιτυχώς με το κτίριο!',
      errorMessage: 'Αποτυχία σύνδεσης ορόφου',
    },
  },
} as const;

// ============================================================================
// 🏢 ENTERPRISE: API Endpoints Configuration
// ============================================================================

/**
 * API endpoints for fetching available entities
 */
export const ENTITY_API_ENDPOINTS: Record<EntityType, string> = {
  company: '/api/companies',
  project: '/api/projects',
  building: '/api/buildings',
  unit: '/api/units',
  floor: '/api/floors',
} as const;

// ============================================================================
// 🏢 ENTERPRISE: Validation Rules
// ============================================================================

/**
 * Minimum ID length for enterprise IDs (Firebase auto-generated)
 */
export const ENTERPRISE_ID_MIN_LENGTH = 20;

/**
 * Legacy ID prefixes to filter out
 */
export const LEGACY_ID_PREFIXES = [
  'building_',
  'project_',
  'unit_',
  'floor_',
  'company_',
] as const;

/**
 * Check if an ID is a valid enterprise ID
 */
export function isEnterpriseId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length < ENTERPRISE_ID_MIN_LENGTH) return false;

  // Check if it starts with a legacy prefix
  for (const prefix of LEGACY_ID_PREFIXES) {
    if (id.startsWith(prefix)) return false;
  }

  return true;
}

// ============================================================================
// 🏢 ENTERPRISE: Helper Functions
// ============================================================================

/**
 * Get the relationship key from entity types
 */
export function getRelationshipKey(
  childType: EntityType,
  parentType: EntityType
): EntityRelationship | null {
  const key = `${childType}-${parentType}` as EntityRelationship;

  if (key in ENTITY_LINKING_CONFIG) {
    return key;
  }

  return null;
}

/**
 * Get configuration for a specific relationship
 */
export function getRelationshipConfig(
  relationship: EntityRelationship
): typeof ENTITY_LINKING_CONFIG[EntityRelationship] | null {
  return ENTITY_LINKING_CONFIG[relationship] ?? null;
}

/**
 * Get API endpoint for an entity type
 */
export function getEntityApiEndpoint(entityType: EntityType): string {
  return ENTITY_API_ENDPOINTS[entityType];
}

// ============================================================================
// 🏢 ENTERPRISE: Error Messages (Centralized)
// ============================================================================

export const ERROR_MESSAGES = {
  ENTITY_NOT_FOUND: 'Η οντότητα δεν βρέθηκε',
  PARENT_NOT_FOUND: 'Η γονική οντότητα δεν βρέθηκε',
  INVALID_RELATIONSHIP: 'Μη έγκυρη σχέση οντοτήτων',
  ALREADY_LINKED: 'Η οντότητα είναι ήδη συνδεδεμένη',
  PERMISSION_DENIED: 'Δεν έχετε δικαίωμα για αυτή την ενέργεια',
  NETWORK_ERROR: 'Σφάλμα δικτύου - Δοκιμάστε ξανά',
  VALIDATION_ERROR: 'Τα δεδομένα δεν είναι έγκυρα',
  UNKNOWN_ERROR: 'Άγνωστο σφάλμα - Επικοινωνήστε με υποστήριξη',
} as const;
