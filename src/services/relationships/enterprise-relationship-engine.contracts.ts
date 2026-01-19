/**
 * 🏢 ENTERPRISE RELATIONSHIP ENGINE - CONTRACTS
 *
 * AutoCAD/SolidWorks-class relationship management system
 * Provides centralized, bidirectional, type-safe entity relationships
 *
 * @enterprise Built for large construction companies
 * @standards ISO 9001, Enterprise Architecture patterns
 * @author Enterprise Development Team
 * @date 2025-12-15
 */

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export type EntityType = 'company' | 'project' | 'building' | 'floor' | 'unit' | 'contact';

export type RelationshipType =
  | 'one_to_many'    // Company → Projects
  | 'many_to_one'    // Projects → Company
  | 'hierarchical'   // Company → Projects → Buildings → Floors → Units
  | 'reference';     // Unit → Contact (owner)

// ============================================================================
// RELATIONSHIP DEFINITION
// ============================================================================

export interface EntityRelationship {
  readonly id: string;
  readonly parentType: EntityType;
  readonly parentId: string;
  readonly childType: EntityType;
  readonly childId: string;
  readonly relationshipType: RelationshipType;
  readonly bidirectional: boolean;
  readonly cascadeDelete: boolean;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly metadata?: RelationshipMetadata;
}

export interface RelationshipMetadata {
  readonly order?: number;           // For ordered relationships (floor order in building)
  readonly weight?: number;          // For weighted relationships (importance)
  readonly tags?: readonly string[]; // For categorization
  readonly customFields?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// OPERATION RESULTS & VALIDATION
// ============================================================================

export interface RelationshipOperationResult {
  readonly success: boolean;
  readonly entityId: string;
  readonly affectedRelationships: readonly EntityRelationship[];
  readonly metadata: {
    readonly operationType: 'CREATE' | 'UPDATE' | 'DELETE';
    readonly timestamp: Date;
    readonly performedBy: string;
    readonly cascadeCount: number;
  };
  readonly errors?: readonly RelationshipError[];
}

export interface RelationshipError {
  readonly code: string;
  readonly message: string;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly field?: string;
}

export interface IntegrityValidationResult {
  readonly isValid: boolean;
  readonly violations: readonly IntegrityViolation[];
  readonly orphanedEntities: readonly OrphanedEntity[];
  readonly circularReferences: readonly CircularReference[];
  readonly checkedAt: Date;
  readonly totalEntitiesChecked: number;
}

export interface IntegrityViolation {
  readonly violationType: 'ORPHANED' | 'CIRCULAR' | 'MISSING_REFERENCE' | 'INVALID_HIERARCHY';
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly description: string;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface OrphanedEntity {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly parentType: EntityType;
  readonly missingParentId: string;
}

export interface CircularReference {
  readonly path: readonly string[];
  readonly startEntityType: EntityType;
  readonly startEntityId: string;
}

// ============================================================================
// CASCADE OPERATIONS
// ============================================================================

export interface CascadeDeleteResult {
  readonly success: boolean;
  readonly deletedEntities: ReadonlyMap<EntityType, readonly string[]>;
  readonly totalDeleted: number;
  readonly skippedEntities: readonly SkippedEntity[];
  readonly executionTime: number;
  readonly rollbackData?: CascadeRollbackData;
}

export interface SkippedEntity {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly reason: string;
}

export interface CascadeRollbackData {
  readonly deletedData: ReadonlyMap<string, unknown>;
  readonly relationshipsData: readonly EntityRelationship[];
  readonly timestamp: Date;
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export interface RelationshipAuditEntry {
  readonly id: string;
  readonly operation: 'CREATE' | 'UPDATE' | 'DELETE';
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly relationshipsBefore?: readonly EntityRelationship[];
  readonly relationshipsAfter?: readonly EntityRelationship[];
  readonly performedBy: string;
  readonly performedAt: Date;
  readonly metadata: RelationshipAuditMetadata;
}

/**
 * 🏢 ENTERPRISE: Extended audit metadata for relationship operations
 * Supports additional fields for enterprise-grade audit trail
 */
export interface RelationshipAuditMetadata {
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly sessionId?: string;
  readonly reason?: string;
  // 🏢 ENTERPRISE: Extended audit fields (2026-01-19)
  readonly targetEntity?: string;      // Format: "entityType:entityId"
  readonly cascadeDeleted?: number;    // Count of cascaded entities deleted
}

// ============================================================================
// ENTERPRISE RELATIONSHIP ENGINE INTERFACE
// ============================================================================

export interface IEnterpriseRelationshipEngine {
  // ========================================
  // RELATIONSHIP MANAGEMENT
  // ========================================

  /**
   * Create bidirectional relationship between entities
   * @enterprise Automatically creates inverse relationship for bidirectional types
   */
  createRelationship(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string,
    options?: CreateRelationshipOptions
  ): Promise<RelationshipOperationResult>;

  /**
   * Remove relationship and optionally cascade
   * @enterprise Handles referential integrity automatically
   */
  removeRelationship(
    relationshipId: string,
    options?: RemoveRelationshipOptions
  ): Promise<RelationshipOperationResult>;

  // ========================================
  // BIDIRECTIONAL QUERIES
  // ========================================

  /**
   * Get all children of specific type for a parent entity
   * @example getChildren('company', 'abc123', 'project') → all projects for company
   */
  getChildren<TChild>(
    parentType: EntityType,
    parentId: string,
    childType: EntityType
  ): Promise<readonly TChild[]>;

  /**
   * Get parent entity of specific type for a child entity
   * @example getParent('project', 'xyz789', 'company') → company for project
   */
  getParent<TParent>(
    childType: EntityType,
    childId: string,
    parentType: EntityType
  ): Promise<TParent | null>;

  /**
   * Get complete entity hierarchy from root to leaves
   * @enterprise Optimized batch queries, includes relationship metadata
   */
  getEntityHierarchy(
    rootType: EntityType,
    rootId: string,
    options?: HierarchyQueryOptions
  ): Promise<EntityHierarchyTree>;

  // ========================================
  // INTEGRITY & VALIDATION
  // ========================================

  /**
   * Validate referential integrity across all entities
   * @enterprise Critical for production deployments
   */
  validateIntegrity(): Promise<IntegrityValidationResult>;

  /**
   * Fix detected integrity violations automatically
   * @enterprise Backs up data before fixing, provides rollback
   */
  repairIntegrityViolations(
    violations: readonly IntegrityViolation[],
    options?: RepairOptions
  ): Promise<RelationshipOperationResult>;

  // ========================================
  // CASCADE OPERATIONS
  // ========================================

  /**
   * Delete entity with full cascade to all dependent entities
   * @enterprise Transaction-safe, provides rollback capability
   */
  cascadeDelete(
    entityType: EntityType,
    entityId: string,
    options?: CascadeDeleteOptions
  ): Promise<CascadeDeleteResult>;

  // ========================================
  // AUDIT & MONITORING
  // ========================================

  /**
   * Get audit trail for entity relationship changes
   * @enterprise Compliance-ready audit logging
   */
  getAuditTrail(
    entityType: EntityType,
    entityId: string,
    options?: AuditQueryOptions
  ): Promise<readonly RelationshipAuditEntry[]>;
}

// ============================================================================
// OPTIONS & CONFIGURATION
// ============================================================================

export interface CreateRelationshipOptions {
  readonly bidirectional?: boolean;
  readonly cascadeDelete?: boolean;
  readonly metadata?: RelationshipMetadata;
  readonly skipValidation?: boolean;
  readonly auditReason?: string;
}

export interface RemoveRelationshipOptions {
  readonly cascade?: boolean;
  readonly skipValidation?: boolean;
  readonly auditReason?: string;
}

export interface HierarchyQueryOptions {
  readonly maxDepth?: number;
  readonly includeMetadata?: boolean;
  readonly filterByType?: readonly EntityType[];
  readonly orderBy?: 'created' | 'name' | 'order';
}

export interface RepairOptions {
  readonly dryRun?: boolean;
  readonly backupBeforeRepair?: boolean;
  readonly maxRepairAttempts?: number;
}

export interface CascadeDeleteOptions {
  readonly dryRun?: boolean;
  readonly force?: boolean;
  readonly includeAudit?: boolean;
  readonly batchSize?: number;
}

export interface AuditQueryOptions {
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly operations?: readonly ('CREATE' | 'UPDATE' | 'DELETE')[];
  readonly performedBy?: string;
  readonly limit?: number;
}

// ============================================================================
// HIERARCHY STRUCTURES
// ============================================================================

export interface EntityHierarchyTree {
  readonly entity: HierarchyEntity;
  readonly children: ReadonlyMap<EntityType, readonly EntityHierarchyTree[]>;
  readonly relationships: readonly EntityRelationship[];
  readonly metadata: {
    readonly totalDescendants: number;
    readonly depth: number;
    readonly lastModified: Date;
  };
}

export interface HierarchyEntity {
  readonly type: EntityType;
  readonly id: string;
  readonly name: string;
  readonly data: unknown;
}

// ============================================================================
// ENTERPRISE VALIDATION RULES
// ============================================================================

export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly entityTypes: readonly EntityType[];
  readonly validate: (entity: unknown, relationships: readonly EntityRelationship[]) => ValidationRuleResult;
}

export interface ValidationRuleResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

export function isValidEntityType(type: string): type is EntityType {
  return ['company', 'project', 'building', 'floor', 'unit', 'contact'].includes(type);
}

export function isHierarchicalRelationship(
  parentType: EntityType,
  childType: EntityType
): boolean {
  const hierarchies: ReadonlyMap<EntityType, readonly EntityType[]> = new Map([
    ['company', ['project']],
    ['project', ['building']],
    ['building', ['floor']],
    ['floor', ['unit']]
  ]);

  return hierarchies.get(parentType)?.includes(childType) ?? false;
}

export function getValidChildTypes(parentType: EntityType): readonly EntityType[] {
  const childrenMap: ReadonlyMap<EntityType, readonly EntityType[]> = new Map([
    ['company', ['project']],
    ['project', ['building']],
    ['building', ['floor']],
    ['floor', ['unit']],
    ['unit', ['contact']] // reference relationship
  ]);

  return childrenMap.get(parentType) ?? [];
}

export function getValidParentTypes(childType: EntityType): readonly EntityType[] {
  const parentMap: ReadonlyMap<EntityType, readonly EntityType[]> = new Map([
    ['project', ['company']],
    ['building', ['project']],
    ['floor', ['building']],
    ['unit', ['floor']],
    ['contact', ['unit']] // can be referenced by units
  ]);

  return parentMap.get(childType) ?? [];
}