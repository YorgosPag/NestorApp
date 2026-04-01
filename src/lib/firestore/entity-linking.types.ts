/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Linking Types (ADR-239)
 * =============================================================================
 *
 * Centralized type definitions for server-side entity linking.
 * Used by entity-linking.service.ts to eliminate duplicate inline cascade
 * blocks across 5 PATCH endpoints (storage, parking, unit, building, project).
 *
 * @see ADR-239 — Entity Linking Centralization
 * @module lib/firestore/entity-linking.types
 */

import type { AuthContext, AuditTargetType } from '@/lib/auth/types';
import type { AuditEntityType } from '@/types/audit-trail';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Cascade strategies supported by the linking service.
 * Maps 1-to-1 with cascade-propagation.service functions — zero duplication.
 */
export type LinkCascadeType =
  | 'child-building'    // Storage/Parking → Building (propagateChildBuildingLink)
  | 'property-building'  // Property → Building (propagatePropertyBuildingLink)
  | 'building-project'  // Building → Project (propagateBuildingProjectLink)
  | 'project-company';  // Project → Company (propagateProjectCompanyLink)

// =============================================================================
// REGISTRY
// =============================================================================

/** Configuration for a single entity link type in the linking pipeline */
export interface LinkRegistryEntry {
  /** Firestore collection name (from COLLECTIONS) */
  readonly collection: string;
  /** Field name that holds the link reference (e.g. 'buildingId') */
  readonly linkField: string;
  /** Cascade strategy to dispatch after the link write */
  readonly cascadeType: LinkCascadeType;
  /** Entity type for EntityAuditService.recordChange() */
  readonly auditEntityType: AuditEntityType;
  /** Target type for logAuditEvent() (auth audit — backward compat) */
  readonly auditTargetType: AuditTargetType;
  /** Status values that lock this link field (null = no field locking) */
  readonly lockedStatuses: readonly string[] | null;
  /** Document field to read the current status for lock check (null if no locking) */
  readonly lockedStatusField: string | null;
  /**
   * When true, skip EntityAuditService.recordChange() for this link.
   * Set for entities whose PATCH handler already runs a full diffFieldsWithResolution audit
   * (currently: property:buildingId — would produce a duplicate audit entry).
   */
  readonly skipAudit: boolean;
}

/**
 * Registry of all linkable entity relationships.
 * Key format: '{entityType}:{linkField}'
 */
export const LINK_REGISTRY: Record<string, LinkRegistryEntry> = {
  'storage:buildingId': {
    collection: COLLECTIONS.STORAGE,
    linkField: 'buildingId',
    cascadeType: 'child-building',
    auditEntityType: 'storage',
    auditTargetType: 'api',
    lockedStatuses: ['sold'],
    lockedStatusField: 'status',
    skipAudit: false,
  },
  'parking:buildingId': {
    collection: COLLECTIONS.PARKING_SPACES,
    linkField: 'buildingId',
    cascadeType: 'child-building',
    auditEntityType: 'parking',
    auditTargetType: 'api',
    lockedStatuses: ['sold'],
    lockedStatusField: 'status',
    skipAudit: false,
  },
  'property:buildingId': {
    collection: COLLECTIONS.PROPERTIES,
    linkField: 'buildingId',
    cascadeType: 'property-building',
    auditEntityType: 'property',
    auditTargetType: 'property',
    lockedStatuses: ['sold', 'rented'],
    lockedStatusField: 'commercialStatus',
    // units/[id] PATCH already runs EntityAuditService.diffFieldsWithResolution for buildingId
    skipAudit: true,
  },
  'building:projectId': {
    collection: COLLECTIONS.BUILDINGS,
    linkField: 'projectId',
    cascadeType: 'building-project',
    auditEntityType: 'building',
    auditTargetType: 'api',
    lockedStatuses: null,
    lockedStatusField: null,
    skipAudit: false,
  },
  'project:linkedCompanyId': {
    collection: COLLECTIONS.PROJECTS,
    linkField: 'linkedCompanyId',
    cascadeType: 'project-company',
    auditEntityType: 'project',
    auditTargetType: 'api',
    lockedStatuses: null,
    lockedStatusField: null,
    skipAudit: false,
  },
} as const;

// =============================================================================
// PARAMS & RESULT
// =============================================================================

/** Parameters passed to linkEntity() */
export interface LinkEntityParams {
  /** Authenticated user context */
  auth: AuthContext;
  /** Entity document ID */
  entityId: string;
  /** New link field value (null = unlink) */
  newLinkValue: string | null;
  /**
   * Existing document data — already fetched by the PATCH handler.
   * Passed in to avoid a redundant Firestore read inside linkEntity.
   * Used for: change detection, field locking check, audit entity name.
   */
  existingDoc: Record<string, unknown>;
  /** API path for audit log metadata */
  apiPath?: string;
}

/** Result returned by linkEntity() */
export interface LinkEntityResult {
  /** Whether the link value actually changed (false → cascade + audit were skipped) */
  changed: boolean;
  /** Previous link value (from existingDoc) */
  oldValue: string | null;
  /** New link value written to Firestore */
  newValue: string | null;
  /** Always null — cascade is dispatched fire-and-forget, result is not awaited */
  cascadeResult: null;
}
