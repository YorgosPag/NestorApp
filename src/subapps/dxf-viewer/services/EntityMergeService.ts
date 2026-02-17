/**
 * Entity Merge Service — AutoCAD JOIN Semantics
 *
 * Handles merging/joining of DXF entities with type-aware result determination.
 * Follows AutoCAD JOIN rules:
 * - Collinear lines → Line
 * - Same center/radius arcs → Arc (or Circle if 360°)
 * - Mixed touching entities → LWPolyline
 * - Closed entities (circles, closed polylines) → NOT joinable
 * - Measurements, text, annotations, blocks → EXCLUDED
 *
 * @see ADR-186: Entity Join System
 */

import type { SceneModel, AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import type {
  LineEntity,
  ArcEntity,
  CircleEntity,
  LWPolylineEntity,
} from '../types/entities';
import { entityToSegments, samePoint, arePointsCollinear } from '../utils/geometry/GeometryUtils';
import { chainSegments } from '../utils/geometry/SegmentChaining';
import { publishHighlight } from '../events/selection-bus';
// ADR-065: Centralized ID Generation (crypto-secure, collision-resistant)
import { generateEntityId } from '../systems/entity-creation/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Whitelist of entity types that can participate in JOIN operations.
 * Matches AutoCAD JOIN command behavior.
 */
const MERGEABLE_ENTITY_TYPES = new Set([
  'line',
  'polyline',
  'lwpolyline',
  'arc',
  'circle',
  'ellipse',
  'rectangle',
  'rect',
]);

/**
 * Entity types that are explicitly excluded from JOIN operations.
 * These are non-geometric or special-purpose entities.
 */
const EXCLUDED_ENTITY_TYPES = new Set([
  'text',
  'mtext',
  'dimension',
  'leader',
  'hatch',
  'block',
  'point',
  'xline',
  'ray',
]);

/**
 * Result type produced by joining entities.
 * AutoCAD JOIN semantics determine which type is produced.
 */
type JoinResultType = 'line' | 'arc' | 'circle' | 'lwpolyline';

// ============================================================================
// TYPES
// ============================================================================

export interface MergeResult {
  updatedScene: SceneModel;
  newEntityId?: string;
  success: boolean;
  message?: string;
}

/** Legacy interface — kept for backward compatibility with MergePanel */
export interface MergeOptions {
  targetEntityId: string;
  sourceEntityIds: string[];
  scene: SceneModel;
  currentLevelId: string;
}

export interface JoinOptions {
  /** All entity IDs to join (no target/source distinction) */
  entityIds: string[];
  scene: SceneModel;
}

export interface JoinPreview {
  canJoin: boolean;
  resultType: JoinResultType | 'not-joinable';
  entityCount: number;
  reason?: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if an entity type is eligible for JOIN operations.
 * Excludes measurements (identified by entity.measurement flag), text, annotations, and blocks.
 */
function isMergeableEntity(entity: AnySceneEntity): boolean {
  // Exclude measurement entities (flagged at creation time)
  if (entity.measurement === true) return false;
  // Exclude non-geometric types
  if (EXCLUDED_ENTITY_TYPES.has(entity.type)) return false;
  // Must be in whitelist
  return MERGEABLE_ENTITY_TYPES.has(entity.type);
}

/**
 * Check if an entity is closed (circle or closed polyline).
 * AutoCAD rule: closed entities cannot participate in JOIN.
 */
function isClosedEntity(entity: AnySceneEntity): boolean {
  if (entity.type === 'circle') return true;
  if (entity.type === 'ellipse') return true;
  if ('closed' in entity && entity.closed === true) return true;
  return false;
}

// ============================================================================
// GEOMETRY ANALYSIS
// ============================================================================

/**
 * Check if ALL entities are collinear lines (connected in a straight line).
 * Uses cross-product test at every shared vertex.
 */
function areAllCollinearLines(entities: AnySceneEntity[], chain: Point2D[]): boolean {
  // All entities must be lines
  if (!entities.every(e => e.type === 'line')) return false;
  // Chain must have at least 3 points to test collinearity
  if (chain.length < 3) return true; // 2-point chain = single line segment = trivially collinear

  // Test every 3 consecutive points in chain
  for (let i = 0; i < chain.length - 2; i++) {
    if (!arePointsCollinear(chain[i], chain[i + 1], chain[i + 2])) {
      return false;
    }
  }
  return true;
}

/**
 * Check if ALL entities are arcs with the same center and radius.
 * If they combine to 360°, the result should be a circle.
 */
function areAllSameArcs(entities: AnySceneEntity[]): { sameArc: boolean; fullCircle: boolean } {
  if (!entities.every(e => e.type === 'arc')) {
    return { sameArc: false, fullCircle: false };
  }

  // Type-safe access: cast first entity to ArcEntity
  const first = entities[0] as unknown as ArcEntity;
  if (!first.center || typeof first.radius !== 'number') {
    return { sameArc: false, fullCircle: false };
  }

  const RADIUS_TOLERANCE = 0.01;

  for (let i = 1; i < entities.length; i++) {
    const arc = entities[i] as unknown as ArcEntity;
    if (!arc.center || typeof arc.radius !== 'number') return { sameArc: false, fullCircle: false };
    if (!samePoint(first.center, arc.center)) return { sameArc: false, fullCircle: false };
    if (Math.abs(first.radius - arc.radius) > RADIUS_TOLERANCE) return { sameArc: false, fullCircle: false };
  }

  // Calculate total angular span
  let totalAngle = 0;
  for (const entity of entities) {
    const arc = entity as unknown as ArcEntity;
    const startAngle = arc.startAngle ?? 0;
    const endAngle = arc.endAngle ?? 0;
    let span = endAngle - startAngle;
    if (span <= 0) span += 360;
    totalAngle += span;
  }

  const isFullCircle = Math.abs(totalAngle - 360) < 1; // 1° tolerance
  return { sameArc: true, fullCircle: isFullCircle };
}

/**
 * Determine the result entity type based on AutoCAD JOIN rules.
 *
 * | Input Combination              | Result      |
 * |-------------------------------|-------------|
 * | Collinear lines               | line        |
 * | Same center/radius arcs       | arc/circle  |
 * | Mixed/non-collinear           | lwpolyline  |
 */
function determineResultType(entities: AnySceneEntity[], chain: Point2D[]): JoinResultType {
  // Check collinear lines first
  if (areAllCollinearLines(entities, chain)) {
    return 'line';
  }

  // Check same-arc fusion
  const arcResult = areAllSameArcs(entities);
  if (arcResult.sameArc) {
    return arcResult.fullCircle ? 'circle' : 'arc';
  }

  // Default: everything else becomes a polyline
  return 'lwpolyline';
}

// ============================================================================
// ENTITY BUILDING
// ============================================================================

/**
 * Build the merged entity based on determined result type.
 * Inherits layer, color, lineweight, opacity, lineType from first entity.
 */
function buildMergedEntity(
  resultType: JoinResultType,
  entities: AnySceneEntity[],
  chain: Point2D[],
  newId: string,
): AnySceneEntity {
  const primary = entities[0];

  // Extract optional visual properties from primary entity (type-safe)
  const lineweight = 'lineweight' in primary && typeof primary.lineweight === 'number'
    ? primary.lineweight : undefined;
  const opacity = 'opacity' in primary && typeof primary.opacity === 'number'
    ? primary.opacity : undefined;
  const lineType = 'lineType' in primary && typeof primary.lineType === 'string'
    ? primary.lineType as 'solid' | 'dashed' | 'dotted' | 'dashdot' : undefined;

  // Common base properties
  const base = {
    id: newId,
    layer: primary.layer ?? '0',
    visible: true,
    name: primary.name || `Joined_${entities.length}_entities`,
    color: primary.color,
    ...(lineweight !== undefined ? { lineweight } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(lineType !== undefined ? { lineType } : {}),
  };

  switch (resultType) {
    case 'line': {
      const result: LineEntity & Pick<typeof base, 'name'> = {
        ...base,
        type: 'line' as const,
        start: chain[0],
        end: chain[chain.length - 1],
      };
      return result as AnySceneEntity;
    }

    case 'circle': {
      const firstArc = entities[0] as unknown as ArcEntity;
      const result: CircleEntity & Pick<typeof base, 'name'> = {
        ...base,
        type: 'circle' as const,
        center: firstArc.center,
        radius: firstArc.radius,
      };
      return result as AnySceneEntity;
    }

    case 'arc': {
      const firstArc = entities[0] as unknown as ArcEntity;
      // Use chain endpoints to compute start/end angles
      const startAngleRad = Math.atan2(chain[0].y - firstArc.center.y, chain[0].x - firstArc.center.x);
      const endAngleRad = Math.atan2(chain[chain.length - 1].y - firstArc.center.y, chain[chain.length - 1].x - firstArc.center.x);
      const radToDeg = (r: number) => ((r * 180) / Math.PI + 360) % 360;
      const result: ArcEntity & Pick<typeof base, 'name'> = {
        ...base,
        type: 'arc' as const,
        center: firstArc.center,
        radius: firstArc.radius,
        startAngle: radToDeg(startAngleRad),
        endAngle: radToDeg(endAngleRad),
      };
      return result as AnySceneEntity;
    }

    case 'lwpolyline':
    default: {
      const isClosed = chain.length >= 3 && samePoint(chain[0], chain[chain.length - 1]);
      const result: LWPolylineEntity & Pick<typeof base, 'name'> = {
        ...base,
        type: 'lwpolyline' as const,
        vertices: chain,
        closed: isClosed,
      };
      return result as AnySceneEntity;
    }
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class EntityMergeService {
  /**
   * Join multiple entities into one using AutoCAD JOIN semantics.
   * No target/source distinction — all entities are equal participants.
   */
  public joinEntities(options: JoinOptions): MergeResult {
    const { entityIds, scene } = options;

    // Resolve entities
    const entities = scene.entities.filter(e => entityIds.includes(e.id));
    if (entities.length < 2) {
      return { updatedScene: scene, success: false, message: 'Need at least 2 entities to join' };
    }

    // Validate all entities are mergeable
    const nonMergeable = entities.filter(e => !isMergeableEntity(e));
    if (nonMergeable.length > 0) {
      const types = [...new Set(nonMergeable.map(e => e.type))].join(', ');
      return { updatedScene: scene, success: false, message: `Cannot join: ${types} entities are not joinable` };
    }

    // Validate no closed entities
    const closed = entities.filter(isClosedEntity);
    if (closed.length > 0) {
      return { updatedScene: scene, success: false, message: 'Cannot join closed entities (circles, closed polylines)' };
    }

    // Attempt geometric join via segment chaining
    return this.executeGeometricJoin(entities, scene);
  }

  /**
   * Legacy mergeEntities method — backward compatibility with MergePanel/useLayerOperations.
   * Converts old target+sources API to new joinEntities API.
   */
  public async mergeEntities(options: MergeOptions): Promise<MergeResult> {
    const allIds = [options.targetEntityId, ...options.sourceEntityIds];
    return this.joinEntities({ entityIds: allIds, scene: options.scene });
  }

  /**
   * Execute the geometric join: segment extraction → chaining → result type → build entity.
   */
  private executeGeometricJoin(entities: AnySceneEntity[], scene: SceneModel): MergeResult {
    const allSegs = entities.flatMap(entityToSegments);
    if (allSegs.length === 0) {
      return { updatedScene: scene, success: false, message: 'No geometry segments found in selected entities' };
    }

    const chain = chainSegments(allSegs, entities);
    if (!chain || chain.length < 2) {
      return { updatedScene: scene, success: false, message: 'Selected entities are not geometrically connected' };
    }

    // Determine output entity type
    const resultType = determineResultType(entities, chain);

    // Build merged entity
    const newId = generateEntityId();
    const mergedEntity = buildMergedEntity(resultType, entities, chain, newId);

    // Update scene: remove originals, add merged
    const toDelete = new Set(entities.map(e => e.id));
    const updatedEntities = scene.entities
      .filter(e => !toDelete.has(e.id))
      .concat([mergedEntity]);

    const updatedScene = { ...scene, entities: updatedEntities };

    // Select the new entity
    publishHighlight({ ids: [newId] });

    return {
      updatedScene,
      newEntityId: newId,
      success: true,
      message: `Joined ${entities.length} entities → ${resultType}`,
    };
  }

  /**
   * Check if given entity IDs can be joined.
   */
  public canJoin(entityIds: string[], scene: SceneModel): boolean {
    if (entityIds.length < 2) return false;
    const entities = scene.entities.filter(e => entityIds.includes(e.id));
    if (entities.length < 2) return false;
    return entities.every(e => isMergeableEntity(e) && !isClosedEntity(e));
  }

  /**
   * Legacy canGeometricallyJoin — backward compatibility.
   */
  public canGeometricallyJoin(entityIds: string[], scene: SceneModel): boolean {
    return this.canJoin(entityIds, scene);
  }

  /**
   * Get a preview of what the join operation would produce.
   */
  public getJoinPreview(entityIds: string[], scene: SceneModel): JoinPreview {
    const entities = scene.entities.filter(e => entityIds.includes(e.id));

    if (entities.length < 2) {
      return { canJoin: false, resultType: 'not-joinable', entityCount: entities.length, reason: 'Need 2+ entities' };
    }

    const nonMergeable = entities.filter(e => !isMergeableEntity(e));
    if (nonMergeable.length > 0) {
      return { canJoin: false, resultType: 'not-joinable', entityCount: entities.length, reason: 'Contains non-joinable types' };
    }

    const closed = entities.filter(isClosedEntity);
    if (closed.length > 0) {
      return { canJoin: false, resultType: 'not-joinable', entityCount: entities.length, reason: 'Contains closed entities' };
    }

    // Attempt chaining to determine result type
    const allSegs = entities.flatMap(entityToSegments);
    const chain = chainSegments(allSegs, entities);
    if (!chain || chain.length < 2) {
      return { canJoin: false, resultType: 'not-joinable', entityCount: entities.length, reason: 'Entities are not connected' };
    }

    const resultType = determineResultType(entities, chain);
    return { canJoin: true, resultType, entityCount: entities.length };
  }

  /**
   * Legacy getMergePreview — backward compatibility.
   */
  public getMergePreview(
    targetEntityId: string,
    sourceEntityIds: string[],
    scene: SceneModel
  ): { canJoin: boolean; resultType: 'polyline' | 'absorb'; entityCount: number } {
    const allIds = [targetEntityId, ...sourceEntityIds];
    const preview = this.getJoinPreview(allIds, scene);
    return {
      canJoin: preview.canJoin,
      resultType: preview.canJoin ? 'polyline' : 'absorb',
      entityCount: preview.entityCount,
    };
  }
}

// ============================================================================
// STATIC HELPERS (exported for use by useEntityJoin hook)
// ============================================================================

export { isMergeableEntity, isClosedEntity };
