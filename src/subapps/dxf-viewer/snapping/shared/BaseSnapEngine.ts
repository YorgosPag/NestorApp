/**
 * Base Snap Engine Interface
 * Κοινό interface για όλα τα snap engines
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { SpatialFactory, type ISpatialIndex, type SpatialQueryResult } from '../../core/spatial';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds, isInfinityBounds, isFinitePoint } from '../../config/geometry-constants';
// 🏢 ADR-378: SSoT snap-visibility predicate (imported DXF entities omit `visible`)
import { isEntityVisibleForSnap } from './snap-visibility';

export interface SnapEngineContext {
  /**
   * 🎯 ADR-728 Φ2 — **broad-phase φιλτραρισμένο** σύνολο: μόνο οι οντότητες των οποίων το AABB
   * τέμνει το aperture box γύρω από τον κέρσορα, υπολογισμένο **μία φορά** στον orchestrator
   * (`snap-broad-phase.ts`) αντί για μία φορά ανά engine (ADR-728 §3.3).
   *
   * **Αυτό είναι το κανονικό μονοπάτι.** Η σειρά είναι η σειρά της σκηνής (οι engines κόβουν στο
   * {@link maxCandidates} — άλλη σειρά ⇒ άλλος νικητής).
   */
  entities: EntityModel[];
  /**
   * 🔴 ADR-728 §Φ2.3 — ο **πλήρης** πίνακας της σκηνής, ΜΟΝΟ για engines με **μη-τοπική
   * γεωμετρία**: εκείνες που δουλεύουν με προεκτάσεις/παραλληλίες, όπου μια οντότητα **εκτός**
   * του aperture μπορεί να παράγει υποψήφιο **εντός** του (`Extension`, `Parallel`, `OrthoTrack`,
   * `Tangent`). Για αυτές το φιλτραρισμένο σύνολο **θα άλλαζε συμπεριφορά**.
   *
   * ⚠️ **Κάθε νέα χρήση απαιτεί αιτιολόγηση** — γραπτή, στο σημείο της χρήσης. Αν μια engine
   * μπορεί να απαντήσει με το {@link entities}, οφείλει να το κάνει: το `allEntities` είναι
   * ακριβώς το κόστος που η Φ2 υπάρχει για να εξαλείψει (2.909 οντότητες ανά κίνηση ποντικιού,
   * μετρημένο `snap:ENTITIES`, ADR-728 §2.3). Διάβασέ το **μόνο** μέσω του
   * {@link resolveNonLocalEntities} — ένα σύμβολο, greppable, με την αιτιολόγηση δίπλα του.
   *
   * **Προαιρετικό by design:** ένα context φτιαγμένο με το χέρι (τα 9 υπάρχοντα engine tests) δεν
   * ξέρει τη διάκριση — εκεί το {@link entities} **είναι** ολόκληρη η σκηνή, άρα η επιστροφή σε
   * αυτό είναι η σωστή απάντηση, όχι συμβιβασμός. Στην παραγωγή το πεδίο δίνεται πάντα
   * (`SnapContextManager.createEngineContext`).
   */
  allEntities?: EntityModel[];
  worldRadiusAt: (point: Point2D) => number;
  worldRadiusForType: (point: Point2D, snapType: ExtendedSnapType) => number;
  perModePxTolerance?: Record<ExtendedSnapType, number>;
  excludeEntityId?: string;
  maxCandidates: number;
}

export interface SnapEngineResult {
  candidates: SnapCandidate[];
  earlyReturn?: {
    found: boolean;
    snapPoint: SnapCandidate;
    allCandidates: SnapCandidate[];
    originalPoint: Point2D;
    snappedPoint: Point2D;
    activeMode: ExtendedSnapType;
    timestamp: number;
  };
}

/**
 * 🔴 ADR-728 §Φ2.3 — η **μοναδική** πόρτα προς τον πλήρη πίνακα σκηνής.
 *
 * Την καλούν αποκλειστικά οι **πέντε** engines με **μη-τοπική** γεωμετρία: οντότητα **εκτός** του
 * aperture box παράγει υποψήφιο **εντός** του.
 *
 * | engine | γιατί μη-τοπική |
 * |---|---|
 * | `Extension` | προέκταση τμήματος, έως `radius × STANDARD` έξω από την οντότητα |
 * | `Parallel` | γραμμή **αναφοράς** αλλού, σημείο έλξης αλλού (`radius × EXTENDED`) |
 * | `OrthoTrack` | σημείο αναφοράς σε 100 world units, άξονες από εκεί |
 * | `Tangent` | σημεία επαφής υπολογισμένα από τον κέρσορα προς μακρινό κύκλο |
 * | `Perpendicular` | πόδι καθέτου **εκτός τμήματος** (`clampToSegment = false`) |
 *
 * ⚠️ Οι τέσσερις πρώτες απαριθμούνται στο ADR-728 §Φ2.3. Η **`Perpendicular` έλειπε** από εκείνη
 * τη λίστα και βρέθηκε από **κόκκινο test**, όχι από ανάγνωση (βλ. `SnapOrchestrator.broad-phase-
 * equivalence.test.ts`). Αν προσθέτεις engine εδώ, γράψε **γιατί** — και προτίμησε να το
 * ανακαλύψεις με διαφορικό test παρά με επιχείρημα.
 *
 * Για κάθε άλλη engine το broad-phase φιλτραρισμένο `context.entities` είναι
 * **η σωστή** πηγή — ADR-728 §8.2: η Φ2 αλλάζει ποιες οντότητες εξετάζονται, ποτέ ποιος νικά.
 *
 * Υπάρχει ως **ένα** σύμβολο ώστε ο κανόνας «κάθε νέα χρήση απαιτεί αιτιολόγηση» να είναι
 * ελέγξιμος με ένα grep αντί για ανάγνωση 26 αρχείων.
 */
export function resolveNonLocalEntities(context: SnapEngineContext): EntityModel[] {
  return context.allEntities ?? context.entities;
}

type SnapSpatialData = {
  point: Point2D;
  entity: EntityModel;
};

export abstract class BaseSnapEngine {
  protected snapType: ExtendedSnapType;
  
  constructor(snapType: ExtendedSnapType) {
    this.snapType = snapType;
  }

  abstract findSnapCandidates(
    cursorPoint: Point2D, 
    context: SnapEngineContext
  ): SnapEngineResult;

  abstract initialize(entities: EntityModel[]): void;

  abstract dispose(): void;

  protected createCandidate(
    point: Point2D,
    description: string,
    distance: number,
    priority: number,
    entityId?: string,
    // ADR-363 Φ1G.5 Slice 2i — the linear reference the snap projected onto (wall
    // face / axis / grid line), for the Revit dashed alignment line. Optional.
    referenceSegment?: { start: Point2D; end: Point2D },
  ): SnapCandidate {
    return {
      point,
      type: this.snapType,
      description,
      distance,
      priority,
      entityId,
      ...(referenceSegment ? { referenceSegment } : {}),
    };
  }

  protected shouldEarlyReturn(
    candidate: SnapCandidate,
    cursorPoint: Point2D,
    distanceThreshold: number
  ): boolean {
    return candidate.distance <= distanceThreshold;
  }

  protected processCandidateLoop<T>(
    entities: EntityModel[],
    context: SnapEngineContext,
    cursorPoint: Point2D,
    priority: number,
    getPointsFromEntity: (entity: EntityModel, ...args: unknown[]) => Array<{point: Point2D, type: string}>,
    createDescriptionLabel: (type: string) => string,
    ...extraArgs: unknown[]
  ): SnapCandidate[] {
    const candidates: SnapCandidate[] = [];
    const radius = context.worldRadiusForType(cursorPoint, this.snapType);
    
    // Guard against non-iterable entities
    if (!Array.isArray(entities)) {
      console.warn('[BaseSnapEngine] entities is not an array:', typeof entities, entities);
      return candidates;
    }
    
    for (const entity of entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!isEntityVisibleForSnap(entity)) continue;

      const points = getPointsFromEntity(entity, ...extraArgs);
      
      for (const pointData of points) {
        const distance = calculateDistance(cursorPoint, pointData.point);
        
        if (distance <= radius) {
          const candidate = this.createCandidate(
            pointData.point,
            createDescriptionLabel(pointData.type),
            distance,
            priority,
            entity.id
          );
          
          candidates.push(candidate);
          
          if (candidates.length >= context.maxCandidates) break;
        }
      }
      
      if (candidates.length >= context.maxCandidates) break;
    }

    return candidates;
  }

  /**
   * 🎯 CENTRALIZED: Initialize spatial index with points from entities
   * Used by snap engines to build spatial indices in a unified way
   *
   * @param entities - Entities to index
   * @param getPoints - Function to extract points from each entity
   * @param pointType - Type label for the points (e.g., 'endpoint', 'midpoint', 'center')
   * @returns Initialized spatial index
   */
  protected initializeSpatialIndex(
    entities: EntityModel[],
    getPoints: (entity: EntityModel) => Point2D[],
    pointType: string
  ): ISpatialIndex {
    // Calculate bounds
    const bounds = this.calculateBoundsFromPoints(entities, getPoints);

    // 🏢 ENTERPRISE: Use imported SpatialFactory (no require)
    const spatialIndex = SpatialFactory.forSnapping(bounds);

    // Build index
    for (const entity of entities) {
      if (!isEntityVisibleForSnap(entity)) continue;

      const points = getPoints(entity);
      for (const point of points) {
        // 🛡️ ADR-510 Φ5 Bug 2 — skip non-finite snap points (a legacy NaN entity must
        // not enter the Grid index, mirror of the aggregate guard below).
        if (!isFinitePoint(point)) continue;
        spatialIndex.insert({
          id: `${entity.id}_${pointType}_${point.x}_${point.y}`,
          bounds: {
            minX: point.x,
            minY: point.y,
            maxX: point.x,
            maxY: point.y
          },
          data: { point, entity }
        });
      }
    }

    return spatialIndex;
  }

  /**
   * 🎯 CENTRALIZED: Calculate spatial bounds from entity points
   * Used by snap engines to create spatial indices
   *
   * @param entities - Entities to calculate bounds from
   * @param getPoints - Function to extract points from each entity
   * @returns Spatial bounds with margin
   */
  protected calculateBoundsFromPoints(
    entities: EntityModel[],
    getPoints: (entity: EntityModel) => Point2D[]
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    if (entities.length === 0) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    // 🏢 ADR-158: Centralized Infinity Bounds Initialization
    const bounds = createInfinityBounds();

    for (const entity of entities) {
      const points = getPoints(entity);
      for (const point of points) {
        // 🛡️ ADR-510 Φ5 Bug 2 — a single non-finite point must not poison the
        // aggregate (NaN → Grid index built at {0,0,0,0} → all snap points rejected).
        if (!isFinitePoint(point)) continue;
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
    }

    // 🏢 ADR-158: Use centralized isInfinityBounds check
    if (isInfinityBounds(bounds)) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    // Add margin (10% or minimum 100 units)
    const margin = Math.max((bounds.maxX - bounds.minX), (bounds.maxY - bounds.minY)) * 0.1 || 100;
    return {
      minX: bounds.minX - margin,
      minY: bounds.minY - margin,
      maxX: bounds.maxX + margin,
      maxY: bounds.maxY + margin
    };
  }

  protected normalizeSnapResults(results: SpatialQueryResult[]): Array<SpatialQueryResult<SnapSpatialData>> {
    return results
      .map(result => {
        const data = result.data;
        if (!this.isSnapSpatialData(data)) {
          return null;
        }
        return { ...result, data };
      })
      .filter((result): result is SpatialQueryResult<SnapSpatialData> => Boolean(result));
  }

  private isSnapSpatialData(value: unknown): value is SnapSpatialData {
    if (!value || typeof value !== 'object') return false;
    if (!('point' in value) || !('entity' in value)) return false;
    const entity = (value as { entity?: unknown }).entity;
    return Boolean(entity && typeof entity === 'object' && 'id' in entity);
  }
}

export interface SnapEngineOptions {
  enabled: boolean;
  priority: number;
  description: string;
  tolerance?: number;
}
