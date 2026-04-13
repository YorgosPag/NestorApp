/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Creation Types (ADR-238)
 * =============================================================================
 *
 * Centralized type definitions for server-side entity creation.
 * Used by entity-creation.service.ts to eliminate duplication across
 * 5 API endpoints (building, floor, unit, storage, parking).
 *
 * @see ADR-238 — Entity Creation Centralization
 * @module lib/firestore/entity-creation.types
 */

import type { AuthContext, AuditTargetType } from '@/lib/auth/types';
import type { AuditEntityType } from '@/types/audit-trail';
import type { PropertyType } from '@/types/property';
import type { ParkingLocationZone } from '@/types/parking';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// CORE TYPES
// =============================================================================

/** Entity types handled by the centralized creation service */
export type ServerEntityType =
  | 'building'
  | 'floor'
  | 'unit'
  | 'property'
  | 'storage'
  | 'parking'
  | 'dxfLevel'
  | 'cadFile'
  | 'dxfOverlayItem';

/**
 * Determines how companyId is resolved.
 * - 'project-child' / 'building-child': companyId inherited from parent document
 * - 'tenant-scoped': companyId taken directly from auth context (no parent fetch)
 */
export type EntityHierarchy = 'project-child' | 'building-child' | 'tenant-scoped';

/** Function names from enterprise-id.service (used for dynamic import) */
export type EntityIdGeneratorName =
  | 'generateBuildingId'
  | 'generateFloorId'
  | 'generatePropertyId'
  | 'generateStorageId'
  | 'generateParkingId'
  | 'generateLevelId'
  | 'generateFileId'
  | 'generateOverlayId';

/** Entity types that support ADR-233 code generation */
export type EntityCodeType = 'property' | 'parking' | 'storage';

// =============================================================================
// REGISTRY
// =============================================================================

/** Configuration for a single entity type in the creation pipeline */
export interface EntityRegistryEntry {
  /** Firestore collection name (from COLLECTIONS) */
  readonly collection: string;
  /** How this entity relates to its parent (project vs building) */
  readonly hierarchy: EntityHierarchy;
  /** Field name that holds the parent reference (null for tenant-scoped entities) */
  readonly parentField: 'projectId' | 'buildingId' | 'floorId' | null;
  /** Enterprise ID generator function name */
  readonly idGenerator: EntityIdGeneratorName;
  /** ADR-233 entity code type (null = no auto-code) */
  readonly codeType: EntityCodeType | null;
  /** Which document field receives the generated code */
  readonly codeField: 'name' | 'number' | 'code' | null;
  /** Whether tenant isolation check is required */
  readonly tenantCheck: boolean;
  /** Audit log target type (legacy auth audit — see logAuditEvent) */
  readonly auditTargetType: AuditTargetType;
  /**
   * Entity audit trail type (ADR-195). When non-null, createEntity() emits
   * an `action: 'created'` entry via EntityAuditService.recordChange() after
   * the Firestore write. Null means the entity is not tracked in
   * `entity_audit_trail` (e.g. DXF/CAD subresources).
   */
  readonly entityAuditType: AuditEntityType | null;
}

/**
 * Registry of all 5 server-side entity types.
 *
 * Contacts (client-side) and Projects (bulk creation) are excluded.
 */
export const ENTITY_REGISTRY: Record<ServerEntityType, EntityRegistryEntry> = {
  building: {
    collection: COLLECTIONS.BUILDINGS,
    hierarchy: 'project-child',
    parentField: 'projectId',
    idGenerator: 'generateBuildingId',
    codeType: null,
    codeField: null,
    tenantCheck: false,
    auditTargetType: 'building',
    entityAuditType: 'building',
  },
  floor: {
    collection: COLLECTIONS.FLOORS,
    hierarchy: 'building-child',
    parentField: 'buildingId',
    idGenerator: 'generateFloorId',
    codeType: null,
    codeField: null,
    tenantCheck: false,
    auditTargetType: 'api',
    entityAuditType: 'floor',
  },
  unit: {
    collection: COLLECTIONS.PROPERTIES,
    hierarchy: 'building-child',
    parentField: 'buildingId',
    idGenerator: 'generatePropertyId',
    codeType: 'property',
    codeField: 'code',
    tenantCheck: true,
    auditTargetType: 'property',
    entityAuditType: 'property',
  },
  property: {
    collection: COLLECTIONS.PROPERTIES,
    hierarchy: 'building-child',
    parentField: 'buildingId',
    idGenerator: 'generatePropertyId',
    codeType: 'property',
    codeField: 'code',
    tenantCheck: true,
    auditTargetType: 'property',
    entityAuditType: 'property',
  },
  storage: {
    collection: COLLECTIONS.STORAGE,
    hierarchy: 'building-child',
    parentField: 'buildingId',
    idGenerator: 'generateStorageId',
    codeType: 'storage',
    codeField: 'code',
    tenantCheck: true,
    auditTargetType: 'api',
    entityAuditType: 'storage',
  },
  parking: {
    collection: COLLECTIONS.PARKING_SPACES,
    hierarchy: 'building-child',
    parentField: 'buildingId',
    idGenerator: 'generateParkingId',
    codeType: 'parking',
    codeField: 'code',
    tenantCheck: true,
    auditTargetType: 'api',
    entityAuditType: 'parking',
  },
  dxfLevel: {
    collection: COLLECTIONS.DXF_VIEWER_LEVELS,
    hierarchy: 'tenant-scoped',
    parentField: 'floorId',
    idGenerator: 'generateLevelId',
    codeType: null,
    codeField: null,
    tenantCheck: false,
    auditTargetType: 'api',
    entityAuditType: null,
  },
  /**
   * 🏢 ADR-288: CAD File metadata (DXF scene metadata, stored in cadFiles collection).
   * Standalone tenant-scoped entity — no parent FK. Client supplies fileId for
   * upsert semantics (auto-save re-writes same doc with incremented version),
   * so the dedicated /api/cad-files handler uses direct adminDb upserts rather
   * than createEntity(). This registry entry exists for SSOT documentation.
   */
  cadFile: {
    collection: COLLECTIONS.CAD_FILES,
    hierarchy: 'tenant-scoped',
    parentField: null,
    idGenerator: 'generateFileId',
    codeType: null,
    codeField: null,
    tenantCheck: false,
    auditTargetType: 'api',
    entityAuditType: null,
  },
  /**
   * 🔷 ADR-289: DXF Overlay polygon item. Stored under the
   * `dxf-overlay-levels/{levelId}/items/{overlayId}` subcollection (NOT a
   * top-level collection — the `collection` field below records the parent
   * prefix for SSOT documentation only). Because createEntity() assumes flat
   * collections, the dedicated /api/dxf-overlay-items handler uses direct
   * adminDb writes against the subcollection path. This registry entry exists
   * purely for SSOT discoverability.
   */
  dxfOverlayItem: {
    collection: COLLECTIONS.DXF_OVERLAY_LEVELS,
    hierarchy: 'tenant-scoped',
    parentField: null,
    idGenerator: 'generateOverlayId',
    codeType: null,
    codeField: null,
    tenantCheck: false,
    auditTargetType: 'api',
    entityAuditType: null,
  },
} as const;

// =============================================================================
// CREATION PARAMS & RESULT
// =============================================================================

/** Parameters passed to createEntity() */
export interface EntityCreationParams {
  /** Authenticated user context */
  auth: AuthContext;
  /** Parent document ID (buildingId or projectId depending on hierarchy) */
  parentId: string | null;
  /** Entity-specific fields (type, status, floor, notes, etc.) */
  entitySpecificFields: Record<string, unknown>;
  /** Options for ADR-233 entity code generation */
  codeOptions?: {
    /** Current code/name value — skip generation if already ADR-233 format */
    currentValue?: string;
    /** Floor level for code generation (default: 0) */
    floorLevel?: number;
    /** Unit type (for unit entity code resolution) */
    unitType?: PropertyType;
    /** Parking location zone (for parking entity code resolution) */
    locationZone?: ParkingLocationZone;
  };
  /** API path for audit log metadata */
  apiPath?: string;
  /**
   * Optional resolvers for ID → display-name translation in audit change values.
   * Key: tracked field name (e.g. `projectId`).
   * Value: async function that receives the raw ID and returns the display name or null.
   * When provided, `createEntity` uses `EntityAuditService.diffFieldsWithResolution`
   * instead of `diffFields` so the History tab shows names, not IDs.
   */
  auditFieldResolvers?: Record<string, (id: unknown) => Promise<string | null>>;
}

/** Result returned by createEntity() */
export interface EntityCreationResult {
  /** Generated enterprise ID */
  id: string;
  /** Generated ADR-233 entity code (null if not applicable) */
  code: string | null;
  /** Full document as written to Firestore */
  doc: Record<string, unknown>;
}

// =============================================================================
// INTERNAL: Parent data fetched from Firestore
// =============================================================================

/** Data extracted from a parent document (building or project) */
export interface ParentData {
  companyId: string;
  name?: string;
  /** ADR-233 §3.4: locked building identifier (preferred over `name` for unit code generation) */
  code?: string;
  projectId?: string;
}
