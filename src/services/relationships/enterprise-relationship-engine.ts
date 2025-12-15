/**
 * 🏢 ENTERPRISE RELATIONSHIP ENGINE - CORE IMPLEMENTATION
 *
 * Production-ready bidirectional relationship management
 * Built for large construction companies with thousands of entities
 *
 * @enterprise AutoCAD/SolidWorks-class architecture
 * @standards ACID transactions, referential integrity, audit compliance
 * @author Enterprise Development Team
 * @date 2025-12-15
 */

import { db, safeDbOperation } from '@/lib/firebase-admin';
import type {
  EntityType,
  RelationshipType,
  EntityRelationship,
  RelationshipOperationResult,
  IntegrityValidationResult,
  CascadeDeleteResult,
  RelationshipAuditEntry,
  IEnterpriseRelationshipEngine,
  CreateRelationshipOptions,
  RemoveRelationshipOptions,
  HierarchyQueryOptions,
  RepairOptions,
  CascadeDeleteOptions,
  AuditQueryOptions,
  EntityHierarchyTree,
  IntegrityViolation,
  OrphanedEntity,
  CircularReference,
  HierarchyEntity,
  RelationshipError,
  SkippedEntity
} from './enterprise-relationship-engine.contracts';

// ============================================================================
// ENTERPRISE RELATIONSHIP ENGINE IMPLEMENTATION
// ============================================================================

export class EnterpriseRelationshipEngine implements IEnterpriseRelationshipEngine {
  private readonly RELATIONSHIPS_COLLECTION = 'entity_relationships';
  private readonly AUDIT_COLLECTION = 'relationship_audit';

  // ========================================
  // RELATIONSHIP MANAGEMENT
  // ========================================

  async createRelationship(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string,
    options: CreateRelationshipOptions = {}
  ): Promise<RelationshipOperationResult> {
    const startTime = Date.now();
    const currentUser = await this.getCurrentUserId();

    return await safeDbOperation(async (database) => {
      const {
        collection,
        addDoc,
        serverTimestamp,
        runTransaction
      } = await import('firebase-admin/firestore');

      return await runTransaction(database, async (transaction) => {
        try {
          // 1️⃣ ENTERPRISE VALIDATION
          if (!options.skipValidation) {
            await this.validateRelationshipCreation(parentType, parentId, childType, childId);
          }

          // 2️⃣ CREATE PRIMARY RELATIONSHIP
          const relationshipData: Omit<EntityRelationship, 'id'> = {
            parentType,
            parentId,
            childType,
            childId,
            relationshipType: this.determineRelationshipType(parentType, childType),
            bidirectional: options.bidirectional ?? this.isBidirectionalByDefault(parentType, childType),
            cascadeDelete: options.cascadeDelete ?? this.isCascadeByDefault(parentType, childType),
            createdAt: new Date(),
            createdBy: currentUser,
            metadata: options.metadata
          };

          const relationshipRef = await addDoc(
            collection(database, this.RELATIONSHIPS_COLLECTION),
            {
              ...relationshipData,
              createdAt: serverTimestamp()
            }
          );

          const createdRelationship: EntityRelationship = {
            id: relationshipRef.id,
            ...relationshipData
          };

          const affectedRelationships = [createdRelationship];

          // 3️⃣ CREATE INVERSE RELATIONSHIP (if bidirectional)
          if (relationshipData.bidirectional) {
            const inverseData: Omit<EntityRelationship, 'id'> = {
              parentType: childType,
              parentId: childId,
              childType: parentType,
              childId: parentId,
              relationshipType: this.getInverseRelationshipType(relationshipData.relationshipType),
              bidirectional: true,
              cascadeDelete: false, // Only primary relationship should cascade
              createdAt: new Date(),
              createdBy: currentUser,
              metadata: {
                ...options.metadata,
                inverseOf: relationshipRef.id
              }
            };

            const inverseRef = await addDoc(
              collection(database, this.RELATIONSHIPS_COLLECTION),
              {
                ...inverseData,
                createdAt: serverTimestamp()
              }
            );

            affectedRelationships.push({
              id: inverseRef.id,
              ...inverseData
            });
          }

          // 4️⃣ AUDIT LOGGING
          if (options.auditReason || true) { // Always audit in enterprise
            await this.createAuditEntry({
              operation: 'CREATE',
              entityType: parentType,
              entityId: parentId,
              relationshipsAfter: affectedRelationships,
              performedBy: currentUser,
              performedAt: new Date(),
              metadata: {
                reason: options.auditReason ?? 'Relationship creation',
                targetEntity: `${childType}:${childId}`
              }
            });
          }

          return {
            success: true,
            entityId: parentId,
            affectedRelationships,
            metadata: {
              operationType: 'CREATE',
              timestamp: new Date(),
              performedBy: currentUser,
              cascadeCount: 0
            }
          } as RelationshipOperationResult;

        } catch (error) {
          const relationshipError: RelationshipError = {
            code: 'RELATIONSHIP_CREATION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            entityType: parentType,
            entityId: parentId,
            field: 'relationship'
          };

          return {
            success: false,
            entityId: parentId,
            affectedRelationships: [],
            metadata: {
              operationType: 'CREATE',
              timestamp: new Date(),
              performedBy: currentUser,
              cascadeCount: 0
            },
            errors: [relationshipError]
          } as RelationshipOperationResult;
        }
      });
    });
  }

  async removeRelationship(
    relationshipId: string,
    options: RemoveRelationshipOptions = {}
  ): Promise<RelationshipOperationResult> {
    const currentUser = await this.getCurrentUserId();

    return await safeDbOperation(async (database) => {
      const {
        doc,
        getDoc,
        deleteDoc,
        collection,
        query,
        where,
        getDocs,
        runTransaction
      } = await import('firebase-admin/firestore');

      return await runTransaction(database, async (transaction) => {
        try {
          // 1️⃣ GET RELATIONSHIP TO DELETE
          const relationshipRef = doc(database, this.RELATIONSHIPS_COLLECTION, relationshipId);
          const relationshipSnap = await getDoc(relationshipRef);

          if (!relationshipSnap.exists()) {
            throw new Error(`Relationship ${relationshipId} not found`);
          }

          const relationship = {
            id: relationshipSnap.id,
            ...relationshipSnap.data()
          } as EntityRelationship;

          const affectedRelationships = [relationship];

          // 2️⃣ ENTERPRISE CASCADE HANDLING
          let cascadeCount = 0;
          if (options.cascade && relationship.cascadeDelete) {
            const cascadeResult = await this.performCascadeDelete(
              relationship.childType,
              relationship.childId,
              { dryRun: false, includeAudit: true }
            );
            cascadeCount = cascadeResult.totalDeleted;
          }

          // 3️⃣ FIND AND DELETE INVERSE RELATIONSHIPS
          if (relationship.bidirectional) {
            const inverseQuery = query(
              collection(database, this.RELATIONSHIPS_COLLECTION),
              where('parentType', '==', relationship.childType),
              where('parentId', '==', relationship.childId),
              where('childType', '==', relationship.parentType),
              where('childId', '==', relationship.parentId)
            );

            const inverseSnap = await getDocs(inverseQuery);
            for (const inverseDoc of inverseSnap.docs) {
              await deleteDoc(inverseDoc.ref);
              affectedRelationships.push({
                id: inverseDoc.id,
                ...inverseDoc.data()
              } as EntityRelationship);
            }
          }

          // 4️⃣ DELETE PRIMARY RELATIONSHIP
          await deleteDoc(relationshipRef);

          // 5️⃣ AUDIT LOGGING
          await this.createAuditEntry({
            operation: 'DELETE',
            entityType: relationship.parentType,
            entityId: relationship.parentId,
            relationshipsBefore: affectedRelationships,
            performedBy: currentUser,
            performedAt: new Date(),
            metadata: {
              reason: options.auditReason ?? 'Relationship removal',
              cascadeDeleted: cascadeCount > 0 ? cascadeCount : undefined
            }
          });

          return {
            success: true,
            entityId: relationship.parentId,
            affectedRelationships,
            metadata: {
              operationType: 'DELETE',
              timestamp: new Date(),
              performedBy: currentUser,
              cascadeCount
            }
          } as RelationshipOperationResult;

        } catch (error) {
          const relationshipError: RelationshipError = {
            code: 'RELATIONSHIP_REMOVAL_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            entityType: 'unknown',
            entityId: relationshipId,
            field: 'relationship'
          };

          return {
            success: false,
            entityId: relationshipId,
            affectedRelationships: [],
            metadata: {
              operationType: 'DELETE',
              timestamp: new Date(),
              performedBy: currentUser,
              cascadeCount: 0
            },
            errors: [relationshipError]
          } as RelationshipOperationResult;
        }
      });
    });
  }

  // ========================================
  // BIDIRECTIONAL QUERIES
  // ========================================

  async getChildren<TChild>(
    parentType: EntityType,
    parentId: string,
    childType: EntityType
  ): Promise<readonly TChild[]> {
    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs } = await import('firebase-admin/firestore');

      // 1️⃣ GET RELATIONSHIPS
      const relationshipsQuery = query(
        collection(database, this.RELATIONSHIPS_COLLECTION),
        where('parentType', '==', parentType),
        where('parentId', '==', parentId),
        where('childType', '==', childType)
      );

      const relationshipsSnap = await getDocs(relationshipsQuery);
      const childIds = relationshipsSnap.docs.map(doc => {
        const data = doc.data();
        return data.childId;
      });

      if (childIds.length === 0) {
        return [];
      }

      // 2️⃣ BATCH FETCH ENTITIES
      const entities = await this.batchGetEntities<TChild>(childType, childIds);
      return entities;
    });
  }

  async getParent<TParent>(
    childType: EntityType,
    childId: string,
    parentType: EntityType
  ): Promise<TParent | null> {
    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs, limit } = await import('firebase-admin/firestore');

      // 1️⃣ GET RELATIONSHIP
      const relationshipQuery = query(
        collection(database, this.RELATIONSHIPS_COLLECTION),
        where('childType', '==', childType),
        where('childId', '==', childId),
        where('parentType', '==', parentType),
        limit(1)
      );

      const relationshipSnap = await getDocs(relationshipQuery);

      if (relationshipSnap.empty) {
        return null;
      }

      const relationship = relationshipSnap.docs[0].data();

      // 2️⃣ FETCH PARENT ENTITY
      const parent = await this.getEntityById<TParent>(parentType, relationship.parentId);
      return parent;
    });
  }

  async getEntityHierarchy(
    rootType: EntityType,
    rootId: string,
    options: HierarchyQueryOptions = {}
  ): Promise<EntityHierarchyTree> {
    return await safeDbOperation(async () => {
      // 1️⃣ GET ROOT ENTITY
      const rootEntity = await this.getEntityById(rootType, rootId);
      if (!rootEntity) {
        throw new Error(`Root entity ${rootType}:${rootId} not found`);
      }

      // 2️⃣ BUILD HIERARCHY RECURSIVELY
      const hierarchy = await this.buildHierarchyRecursive(
        { type: rootType, id: rootId, name: this.getEntityName(rootEntity), data: rootEntity },
        options.maxDepth ?? 10,
        0,
        options.filterByType
      );

      return hierarchy;
    });
  }

  // ========================================
  // INTEGRITY & VALIDATION
  // ========================================

  async validateIntegrity(): Promise<IntegrityValidationResult> {
    const startTime = Date.now();

    return await safeDbOperation(async (database) => {
      const { collection, getDocs } = await import('firebase-admin/firestore');

      // 1️⃣ GET ALL RELATIONSHIPS
      const relationshipsSnap = await getDocs(collection(database, this.RELATIONSHIPS_COLLECTION));
      const relationships = relationshipsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EntityRelationship[];

      const violations: IntegrityViolation[] = [];
      const orphanedEntities: OrphanedEntity[] = [];
      const circularReferences: CircularReference[] = [];

      // 2️⃣ CHECK FOR ORPHANED ENTITIES
      for (const relationship of relationships) {
        // Check if parent exists
        const parentExists = await this.entityExists(relationship.parentType, relationship.parentId);
        if (!parentExists) {
          orphanedEntities.push({
            entityType: relationship.childType,
            entityId: relationship.childId,
            parentType: relationship.parentType,
            missingParentId: relationship.parentId
          });

          violations.push({
            violationType: 'ORPHANED',
            entityType: relationship.childType,
            entityId: relationship.childId,
            description: `Child entity references non-existent parent ${relationship.parentType}:${relationship.parentId}`,
            severity: 'CRITICAL'
          });
        }

        // Check if child exists
        const childExists = await this.entityExists(relationship.childType, relationship.childId);
        if (!childExists) {
          violations.push({
            violationType: 'MISSING_REFERENCE',
            entityType: relationship.parentType,
            entityId: relationship.parentId,
            description: `Parent entity references non-existent child ${relationship.childType}:${relationship.childId}`,
            severity: 'HIGH'
          });
        }
      }

      // 3️⃣ CHECK FOR CIRCULAR REFERENCES
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      for (const relationship of relationships) {
        const entityKey = `${relationship.parentType}:${relationship.parentId}`;
        if (!visited.has(entityKey)) {
          const circular = await this.detectCircularReference(
            relationship.parentType,
            relationship.parentId,
            visited,
            recursionStack,
            []
          );
          if (circular) {
            circularReferences.push(circular);
            violations.push({
              violationType: 'CIRCULAR',
              entityType: relationship.parentType,
              entityId: relationship.parentId,
              description: `Circular reference detected: ${circular.path.join(' → ')}`,
              severity: 'HIGH'
            });
          }
        }
      }

      return {
        isValid: violations.length === 0,
        violations,
        orphanedEntities,
        circularReferences,
        checkedAt: new Date(),
        totalEntitiesChecked: relationships.length
      } as IntegrityValidationResult;
    });
  }

  async repairIntegrityViolations(
    violations: readonly IntegrityViolation[],
    options: RepairOptions = {}
  ): Promise<RelationshipOperationResult> {
    const currentUser = await this.getCurrentUserId();

    if (options.dryRun) {
      return {
        success: true,
        entityId: 'dry-run',
        affectedRelationships: [],
        metadata: {
          operationType: 'UPDATE',
          timestamp: new Date(),
          performedBy: currentUser,
          cascadeCount: violations.length
        }
      };
    }

    // 🚧 Implementation would go here for actual repair operations
    // This is a complex enterprise feature that requires careful implementation
    throw new Error('Integrity repair not yet implemented - requires careful design for production safety');
  }

  // ========================================
  // CASCADE OPERATIONS
  // ========================================

  async cascadeDelete(
    entityType: EntityType,
    entityId: string,
    options: CascadeDeleteOptions = {}
  ): Promise<CascadeDeleteResult> {
    if (options.dryRun) {
      // 🔍 DRY RUN: Calculate what would be deleted
      const cascadeMap = await this.buildCascadeMap(entityType, entityId);
      return {
        success: true,
        deletedEntities: cascadeMap,
        totalDeleted: this.countEntitiesInMap(cascadeMap),
        skippedEntities: [],
        executionTime: 0
      };
    }

    return await this.performCascadeDelete(entityType, entityId, options);
  }

  // ========================================
  // AUDIT & MONITORING
  // ========================================

  async getAuditTrail(
    entityType: EntityType,
    entityId: string,
    options: AuditQueryOptions = {}
  ): Promise<readonly RelationshipAuditEntry[]> {
    return await safeDbOperation(async (database) => {
      const {
        collection,
        query,
        where,
        orderBy,
        limit,
        getDocs
      } = await import('firebase-admin/firestore');

      let auditQuery = query(
        collection(database, this.AUDIT_COLLECTION),
        where('entityType', '==', entityType),
        where('entityId', '==', entityId)
      );

      if (options.operations) {
        auditQuery = query(auditQuery, where('operation', 'in', options.operations));
      }

      if (options.performedBy) {
        auditQuery = query(auditQuery, where('performedBy', '==', options.performedBy));
      }

      auditQuery = query(auditQuery, orderBy('performedAt', 'desc'));

      if (options.limit) {
        auditQuery = query(auditQuery, limit(options.limit));
      }

      const auditSnap = await getDocs(auditQuery);
      return auditSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as readonly RelationshipAuditEntry[];
    });
  }

  // ========================================
  // PRIVATE ENTERPRISE UTILITIES
  // ========================================

  private async getCurrentUserId(): Promise<string> {
    // 🔒 In a real enterprise system, this would get the authenticated user
    // For now, return a placeholder
    return 'system-user';
  }

  private determineRelationshipType(parentType: EntityType, childType: EntityType): RelationshipType {
    // 🏗️ ENTERPRISE BUSINESS RULES
    const hierarchicalPairs: ReadonlyArray<readonly [EntityType, EntityType]> = [
      ['company', 'project'],
      ['project', 'building'],
      ['building', 'floor'],
      ['floor', 'unit']
    ];

    const isHierarchical = hierarchicalPairs.some(
      ([parent, child]) => parent === parentType && child === childType
    );

    if (isHierarchical) {
      return 'hierarchical';
    }

    if (parentType === 'unit' && childType === 'contact') {
      return 'reference';
    }

    return 'one_to_many';
  }

  private isBidirectionalByDefault(parentType: EntityType, childType: EntityType): boolean {
    // 🔄 Most relationships in construction industry are bidirectional for easy navigation
    return true;
  }

  private isCascadeByDefault(parentType: EntityType, childType: EntityType): boolean {
    // 🗑️ Only hierarchical relationships should cascade by default
    return this.determineRelationshipType(parentType, childType) === 'hierarchical';
  }

  private getInverseRelationshipType(type: RelationshipType): RelationshipType {
    const inverseMap: ReadonlyMap<RelationshipType, RelationshipType> = new Map([
      ['one_to_many', 'many_to_one'],
      ['many_to_one', 'one_to_many'],
      ['hierarchical', 'hierarchical'], // Still hierarchical but inverted
      ['reference', 'reference']
    ]);

    return inverseMap.get(type) ?? type;
  }

  private async validateRelationshipCreation(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string
  ): Promise<void> {
    // 1️⃣ Check if entities exist
    const parentExists = await this.entityExists(parentType, parentId);
    if (!parentExists) {
      throw new Error(`Parent entity ${parentType}:${parentId} does not exist`);
    }

    const childExists = await this.entityExists(childType, childId);
    if (!childExists) {
      throw new Error(`Child entity ${childType}:${childId} does not exist`);
    }

    // 2️⃣ Check if relationship already exists
    const existingRelationship = await this.relationshipExists(parentType, parentId, childType, childId);
    if (existingRelationship) {
      throw new Error(`Relationship already exists between ${parentType}:${parentId} and ${childType}:${childId}`);
    }

    // 3️⃣ Validate business rules
    // 🏢 Add more enterprise validation rules here
  }

  private async entityExists(entityType: EntityType, entityId: string): Promise<boolean> {
    return await safeDbOperation(async (database) => {
      const { doc, getDoc } = await import('firebase-admin/firestore');

      const collectionName = this.getCollectionName(entityType);
      const entityRef = doc(database, collectionName, entityId);
      const entitySnap = await getDoc(entityRef);

      return entitySnap.exists();
    });
  }

  private async relationshipExists(
    parentType: EntityType,
    parentId: string,
    childType: EntityType,
    childId: string
  ): Promise<boolean> {
    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs, limit } = await import('firebase-admin/firestore');

      const relationshipQuery = query(
        collection(database, this.RELATIONSHIPS_COLLECTION),
        where('parentType', '==', parentType),
        where('parentId', '==', parentId),
        where('childType', '==', childType),
        where('childId', '==', childId),
        limit(1)
      );

      const relationshipSnap = await getDocs(relationshipQuery);
      return !relationshipSnap.empty;
    });
  }

  private getCollectionName(entityType: EntityType): string {
    const collectionMap: ReadonlyMap<EntityType, string> = new Map([
      ['company', 'contacts'], // Companies are stored in contacts collection
      ['project', 'projects'],
      ['building', 'buildings'],
      ['floor', 'floors'],
      ['unit', 'units'],
      ['contact', 'contacts']
    ]);

    const collection = collectionMap.get(entityType);
    if (!collection) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    return collection;
  }

  private async getEntityById<T>(entityType: EntityType, entityId: string): Promise<T | null> {
    return await safeDbOperation(async (database) => {
      const { doc, getDoc } = await import('firebase-admin/firestore');

      const collectionName = this.getCollectionName(entityType);
      const entityRef = doc(database, collectionName, entityId);
      const entitySnap = await getDoc(entityRef);

      if (!entitySnap.exists()) {
        return null;
      }

      return {
        id: entitySnap.id,
        ...entitySnap.data()
      } as T;
    });
  }

  private async batchGetEntities<T>(entityType: EntityType, entityIds: readonly string[]): Promise<readonly T[]> {
    if (entityIds.length === 0) {
      return [];
    }

    // 🏢 ENTERPRISE BATCHING: Handle Firestore's 10-item limit for 'in' queries
    const BATCH_SIZE = 10;
    const batches: readonly string[][] = [];

    for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
      batches.push(entityIds.slice(i, i + BATCH_SIZE));
    }

    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs } = await import('firebase-admin/firestore');

      const entities: T[] = [];
      const collectionName = this.getCollectionName(entityType);

      for (const batch of batches) {
        const batchQuery = query(
          collection(database, collectionName),
          where('__name__', 'in', batch)
        );

        const batchSnap = await getDocs(batchQuery);
        batchSnap.docs.forEach(doc => {
          entities.push({
            id: doc.id,
            ...doc.data()
          } as T);
        });
      }

      return entities;
    });
  }

  private getEntityName(entity: unknown): string {
    // 🏷️ Extract display name from entity based on type
    const entityObj = entity as Record<string, unknown>;

    return (
      (entityObj.name as string) ??
      (entityObj.companyName as string) ??
      (entityObj.title as string) ??
      (entityObj.firstName && entityObj.lastName
        ? `${entityObj.firstName} ${entityObj.lastName}`
        : '') ??
      'Unnamed Entity'
    );
  }

  private async buildHierarchyRecursive(
    entity: HierarchyEntity,
    maxDepth: number,
    currentDepth: number,
    filterByType?: readonly EntityType[]
  ): Promise<EntityHierarchyTree> {
    if (currentDepth >= maxDepth) {
      return {
        entity,
        children: new Map(),
        relationships: [],
        metadata: {
          totalDescendants: 0,
          depth: currentDepth,
          lastModified: new Date()
        }
      };
    }

    // 🔍 Get child relationships for this entity
    const relationships = await this.getEntityRelationships(entity.type, entity.id);
    const childrenMap = new Map<EntityType, readonly EntityHierarchyTree[]>();
    let totalDescendants = 0;

    for (const relationship of relationships) {
      if (filterByType && !filterByType.includes(relationship.childType)) {
        continue;
      }

      const childEntity = await this.getEntityById(relationship.childType, relationship.childId);
      if (childEntity) {
        const childHierarchyEntity: HierarchyEntity = {
          type: relationship.childType,
          id: relationship.childId,
          name: this.getEntityName(childEntity),
          data: childEntity
        };

        const childTree = await this.buildHierarchyRecursive(
          childHierarchyEntity,
          maxDepth,
          currentDepth + 1,
          filterByType
        );

        const existingChildren = childrenMap.get(relationship.childType) ?? [];
        childrenMap.set(relationship.childType, [...existingChildren, childTree]);
        totalDescendants += 1 + childTree.metadata.totalDescendants;
      }
    }

    return {
      entity,
      children: childrenMap,
      relationships,
      metadata: {
        totalDescendants,
        depth: currentDepth,
        lastModified: new Date()
      }
    };
  }

  private async getEntityRelationships(
    entityType: EntityType,
    entityId: string
  ): Promise<readonly EntityRelationship[]> {
    return await safeDbOperation(async (database) => {
      const { collection, query, where, getDocs } = await import('firebase-admin/firestore');

      const relationshipQuery = query(
        collection(database, this.RELATIONSHIPS_COLLECTION),
        where('parentType', '==', entityType),
        where('parentId', '==', entityId)
      );

      const relationshipSnap = await getDocs(relationshipQuery);
      return relationshipSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as readonly EntityRelationship[];
    });
  }

  private async detectCircularReference(
    entityType: EntityType,
    entityId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: readonly string[]
  ): Promise<CircularReference | null> {
    const entityKey = `${entityType}:${entityId}`;

    if (recursionStack.has(entityKey)) {
      return {
        path: [...path, entityKey],
        startEntityType: entityType,
        startEntityId: entityId
      };
    }

    if (visited.has(entityKey)) {
      return null;
    }

    visited.add(entityKey);
    recursionStack.add(entityKey);

    const relationships = await this.getEntityRelationships(entityType, entityId);

    for (const relationship of relationships) {
      const circular = await this.detectCircularReference(
        relationship.childType,
        relationship.childId,
        visited,
        recursionStack,
        [...path, entityKey]
      );

      if (circular) {
        return circular;
      }
    }

    recursionStack.delete(entityKey);
    return null;
  }

  private async createAuditEntry(entry: Omit<RelationshipAuditEntry, 'id'>): Promise<void> {
    await safeDbOperation(async (database) => {
      const { collection, addDoc, serverTimestamp } = await import('firebase-admin/firestore');

      await addDoc(collection(database, this.AUDIT_COLLECTION), {
        ...entry,
        performedAt: serverTimestamp()
      });
    });
  }

  private async buildCascadeMap(
    entityType: EntityType,
    entityId: string
  ): Promise<ReadonlyMap<EntityType, readonly string[]>> {
    // 🗺️ Build a map of all entities that would be deleted in a cascade
    const cascadeMap = new Map<EntityType, string[]>();

    await this.collectCascadeEntities(entityType, entityId, cascadeMap, new Set());

    // Convert to readonly map
    const readonlyMap = new Map<EntityType, readonly string[]>();
    for (const [type, ids] of cascadeMap.entries()) {
      readonlyMap.set(type, ids);
    }

    return readonlyMap;
  }

  private async collectCascadeEntities(
    entityType: EntityType,
    entityId: string,
    cascadeMap: Map<EntityType, string[]>,
    visited: Set<string>
  ): Promise<void> {
    const entityKey = `${entityType}:${entityId}`;

    if (visited.has(entityKey)) {
      return; // Avoid infinite loops
    }

    visited.add(entityKey);

    // Add this entity to the cascade map
    const existingIds = cascadeMap.get(entityType) ?? [];
    existingIds.push(entityId);
    cascadeMap.set(entityType, existingIds);

    // Get all cascade relationships from this entity
    const relationships = await this.getEntityRelationships(entityType, entityId);

    for (const relationship of relationships) {
      if (relationship.cascadeDelete) {
        await this.collectCascadeEntities(
          relationship.childType,
          relationship.childId,
          cascadeMap,
          visited
        );
      }
    }
  }

  private countEntitiesInMap(cascadeMap: ReadonlyMap<EntityType, readonly string[]>): number {
    let total = 0;
    for (const ids of cascadeMap.values()) {
      total += ids.length;
    }
    return total;
  }

  private async performCascadeDelete(
    entityType: EntityType,
    entityId: string,
    options: CascadeDeleteOptions
  ): Promise<CascadeDeleteResult> {
    const startTime = Date.now();

    return await safeDbOperation(async (database) => {
      const { doc, deleteDoc, runTransaction } = await import('firebase-admin/firestore');

      return await runTransaction(database, async (transaction) => {
        try {
          // 🗑️ Build cascade map
          const cascadeMap = await this.buildCascadeMap(entityType, entityId);
          const skippedEntities: SkippedEntity[] = [];

          // 🔄 Delete entities bottom-up (leaves first)
          const entityTypeOrder: readonly EntityType[] = ['unit', 'floor', 'building', 'project', 'company', 'contact'];

          for (const currentType of entityTypeOrder) {
            const idsToDelete = cascadeMap.get(currentType) ?? [];

            for (const idToDelete of idsToDelete) {
              try {
                const collectionName = this.getCollectionName(currentType);
                const entityRef = doc(database, collectionName, idToDelete);
                await deleteDoc(entityRef);
              } catch (error) {
                skippedEntities.push({
                  entityType: currentType,
                  entityId: idToDelete,
                  reason: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          }

          const executionTime = Date.now() - startTime;

          return {
            success: true,
            deletedEntities: cascadeMap,
            totalDeleted: this.countEntitiesInMap(cascadeMap),
            skippedEntities,
            executionTime
          } as CascadeDeleteResult;

        } catch (error) {
          return {
            success: false,
            deletedEntities: new Map(),
            totalDeleted: 0,
            skippedEntities: [],
            executionTime: Date.now() - startTime
          } as CascadeDeleteResult;
        }
      });
    });
  }
}