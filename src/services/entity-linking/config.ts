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
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const ENTITY_LINKING_CONFIG: EntityLinkingConfig = {
  'project-company': {
    collection: COLLECTIONS.PROJECTS,
    foreignKey: 'companyId',
    successEvent: REALTIME_EVENTS.NAVIGATION_REFRESH,
    labels: {
      linkAction: 'entityLinking.projectCompany.linkAction',
      unlinkAction: 'entityLinking.projectCompany.unlinkAction',
      successMessage: 'entityLinking.projectCompany.successMessage',
      errorMessage: 'entityLinking.projectCompany.errorMessage',
    },
  },

  'building-project': {
    collection: COLLECTIONS.BUILDINGS,
    foreignKey: 'projectId',
    successEvent: REALTIME_EVENTS.NAVIGATION_REFRESH,
    labels: {
      linkAction: 'entityLinking.buildingProject.linkAction',
      unlinkAction: 'entityLinking.buildingProject.unlinkAction',
      successMessage: 'entityLinking.buildingProject.successMessage',
      errorMessage: 'entityLinking.buildingProject.errorMessage',
    },
  },

  'unit-building': {
    collection: COLLECTIONS.UNITS,
    foreignKey: 'buildingId',
    successEvent: REALTIME_EVENTS.UNIT_BUILDING_LINKED,
    labels: {
      linkAction: 'entityLinking.unitBuilding.linkAction',
      unlinkAction: 'entityLinking.unitBuilding.unlinkAction',
      successMessage: 'entityLinking.unitBuilding.successMessage',
      errorMessage: 'entityLinking.unitBuilding.errorMessage',
    },
  },

  'floor-building': {
    collection: COLLECTIONS.FLOORS,
    foreignKey: 'buildingId',
    successEvent: REALTIME_EVENTS.NAVIGATION_REFRESH,
    labels: {
      linkAction: 'entityLinking.floorBuilding.linkAction',
      unlinkAction: 'entityLinking.floorBuilding.unlinkAction',
      successMessage: 'entityLinking.floorBuilding.successMessage',
      errorMessage: 'entityLinking.floorBuilding.errorMessage',
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

// 🌐 i18n: Error messages converted to i18n keys - 2026-01-18
export const ERROR_MESSAGES = {
  ENTITY_NOT_FOUND: 'entityLinking.errors.entityNotFound',
  PARENT_NOT_FOUND: 'entityLinking.errors.parentNotFound',
  INVALID_RELATIONSHIP: 'entityLinking.errors.invalidRelationship',
  ALREADY_LINKED: 'entityLinking.errors.alreadyLinked',
  PERMISSION_DENIED: 'entityLinking.errors.permissionDenied',
  NETWORK_ERROR: 'entityLinking.errors.networkError',
  VALIDATION_ERROR: 'entityLinking.errors.validationError',
  UNKNOWN_ERROR: 'entityLinking.errors.unknownError',
} as const;
