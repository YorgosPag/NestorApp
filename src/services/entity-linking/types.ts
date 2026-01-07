/**
 * 🏢 ENTERPRISE: Entity Linking Service Types
 *
 * Centralized type definitions for the Entity Linking System.
 * Follows Fortune 500 enterprise patterns (Bentley, Google, Microsoft).
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Single Source of Truth for Entity Relationships
 */

// ============================================================================
// 🏢 ENTERPRISE: Entity Types (ZERO any)
// ============================================================================

/**
 * Supported entity types in the system
 */
export type EntityType = 'company' | 'project' | 'building' | 'unit' | 'floor';

/**
 * Entity relationship pairs - defines valid parent-child relationships
 */
export type EntityRelationship =
  | 'project-company'
  | 'building-project'
  | 'unit-building'
  | 'floor-building';

/**
 * Base entity interface - all entities must have these fields
 */
export interface BaseEntity {
  readonly id: string;
  readonly name: string;
}

/**
 * Extended entity with optional metadata
 */
export interface EntityWithMetadata extends BaseEntity {
  readonly subtitle?: string;
  readonly description?: string;
  readonly status?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

// ============================================================================
// 🏢 ENTERPRISE: Link Operation Types
// ============================================================================

/**
 * Parameters for linking an entity to a parent
 */
export interface LinkEntityParams {
  /** The entity being linked (child) */
  readonly entityId: string;
  /** The entity type being linked */
  readonly entityType: EntityType;
  /** The parent entity ID */
  readonly parentId: string;
  /** The parent entity type */
  readonly parentType: EntityType;
}

/**
 * Parameters for unlinking an entity from its parent
 */
export interface UnlinkEntityParams {
  /** The entity being unlinked */
  readonly entityId: string;
  /** The entity type */
  readonly entityType: EntityType;
}

/**
 * Parameters for fetching available entities for linking
 */
export interface GetAvailableEntitiesParams {
  /** The type of entities to fetch */
  readonly entityType: EntityType;
  /** The parent entity ID (to filter already linked entities) */
  readonly parentId?: string;
  /** The parent entity type */
  readonly parentType?: EntityType;
  /** Whether to include entities already linked to other parents */
  readonly includeLinkedToOthers?: boolean;
}

// ============================================================================
// 🏢 ENTERPRISE: Result Types
// ============================================================================

/**
 * Base result interface for all operations
 */
export interface BaseOperationResult {
  readonly success: boolean;
  readonly timestamp: number;
}

/**
 * Successful link operation result
 */
export interface LinkSuccessResult extends BaseOperationResult {
  readonly success: true;
  readonly entityId: string;
  readonly entityType: EntityType;
  readonly parentId: string;
  readonly parentType: EntityType;
  readonly previousParentId: string | null;
}

/**
 * Failed operation result
 */
export interface OperationErrorResult extends BaseOperationResult {
  readonly success: false;
  readonly error: string;
  readonly errorCode: EntityLinkingErrorCode;
  readonly details?: string;
}

/**
 * Union type for link operation results
 */
export type LinkResult = LinkSuccessResult | OperationErrorResult;

/**
 * Result for fetching available entities
 */
export interface GetAvailableEntitiesResult {
  readonly success: boolean;
  readonly entities: EntityWithMetadata[];
  readonly count: number;
  readonly error?: string;
}

// ============================================================================
// 🏢 ENTERPRISE: Error Codes (Type-safe)
// ============================================================================

/**
 * Centralized error codes for entity linking operations
 */
export type EntityLinkingErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'PARENT_NOT_FOUND'
  | 'INVALID_RELATIONSHIP'
  | 'ALREADY_LINKED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

// ============================================================================
// 🏢 ENTERPRISE: Configuration Types
// ============================================================================

/**
 * Configuration for a specific entity relationship
 */
export interface RelationshipConfig {
  /** The Firestore collection for the child entity */
  readonly collection: string;
  /** The foreign key field name in the child entity */
  readonly foreignKey: string;
  /** Event to dispatch on successful link */
  readonly successEvent: string;
  /** Human-readable labels for UI */
  readonly labels: {
    readonly linkAction: string;
    readonly unlinkAction: string;
    readonly successMessage: string;
    readonly errorMessage: string;
  };
}

/**
 * Full configuration map for all relationships
 */
export type EntityLinkingConfig = Record<EntityRelationship, RelationshipConfig>;

// ============================================================================
// 🏢 ENTERPRISE: Event Payloads
// ============================================================================

/**
 * Payload for entity link events
 */
export interface EntityLinkEventPayload {
  readonly entityId: string;
  readonly entityType: EntityType;
  readonly previousParentId: string | null;
  readonly newParentId: string | null;
  readonly timestamp: number;
}

// ============================================================================
// 🏢 ENTERPRISE: Hook Return Types
// ============================================================================

/**
 * Return type for useEntityLinking hook
 */
export interface UseEntityLinkingReturn {
  /** Link an entity to a parent */
  readonly link: (params: LinkEntityParams) => Promise<LinkResult>;
  /** Unlink an entity from its parent */
  readonly unlink: (params: UnlinkEntityParams) => Promise<LinkResult>;
  /** Get available entities for linking */
  readonly getAvailable: (params: GetAvailableEntitiesParams) => Promise<GetAvailableEntitiesResult>;
  /** Loading state */
  readonly isLoading: boolean;
  /** Last error (if any) */
  readonly error: string | null;
  /** Clear error state */
  readonly clearError: () => void;
}
