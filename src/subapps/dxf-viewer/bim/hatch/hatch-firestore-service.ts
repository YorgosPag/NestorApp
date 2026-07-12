'use client';

/**
 * ADR-507 — Hatch Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_hatches/{id}` (companyId-scoped via field, floor-scoped
 * via ADR-420 `floorId`/`floorplanId`). Mirrors `FloorFinishFirestoreService`
 * (ADR-419) — but the hatch is a FLAT DXF primitive, NOT a BIM shape: no
 * `kind/params/geometry/validation`. Its semantic payload (boundaryPaths + fill
 * fields) is stored under a single `data` sub-key so the persistence hook can
 * diff it in one `dequal` (mirror of floor-finish's `params` diff) and so the
 * nested `boundaryPaths` (Point2D[][]) lives inside a map field (Firestore forbids
 * directly-nested arrays only at the document top level).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateHatchId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see docs/centralized-systems/reference/adrs/ADR-420-bim-floor-scope-ssot.md
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateHatchId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import type { Point2D } from '../../rendering/types/Types';
import type { HatchEntity } from '../../types/entities';
import type { HatchGradient } from './hatch-gradient';

// ============================================================================
// TYPES
// ============================================================================

/**
 * The persistable hatch payload — the flat DXF hatch fields (NO BaseEntity styling
 * beyond `fillColor`, NO kind/params/geometry). This is the single diff unit
 * (mirror of floor-finish `params`).
 */
/**
 * One closed boundary ring, persisted as a MAP wrapping its vertex array.
 * ⚠️ Firestore forbids directly-nested arrays ANYWHERE (an array element cannot
 * itself be an array — not even inside a map). The runtime `HatchEntity.boundaryPaths`
 * is `Point2D[][]`; we serialise each ring to `{ vertices }` so the stored field is
 * an array-of-MAPS (legal) instead of an array-of-arrays (rejected).
 */
export interface HatchBoundaryRing {
  readonly vertices: Point2D[];
}

export interface HatchDocData {
  readonly boundaryPaths: HatchBoundaryRing[];
  readonly patternName?: string;
  readonly patternType?: 'solid' | 'gradient' | 'pattern';
  readonly patternScale?: number;
  readonly patternAngle?: number;
  readonly seedPoints?: Point2D[];
  readonly fillColor?: string;
  readonly backgroundColor?: string;
  readonly associative?: boolean;
  readonly fillType?: 'solid' | 'user-defined' | 'predefined' | 'gradient';
  readonly islandStyle?: 'normal' | 'outer' | 'ignore';
  readonly lineAngle?: number;
  readonly lineSpacing?: number;
  readonly doubleCrossHatch?: boolean;
  /** ADR-531 Φ5b.6 — 'screen' = raster μοτίβο σταθερής πυκνότητας px (zoom-independent). */
  readonly patternSpace?: 'world' | 'screen';
  readonly patternOrigin?: Point2D;
  readonly drawOrder?: 0 | 1 | 2 | 3 | 4;
  readonly gapTolerance?: number;
  /** ADR-507 — AutoCAD object transparency % (0..90· DXF 440). Κληρονομείται από BaseEntity. */
  readonly transparency?: number;
  /** ADR-507 Φ5 — gradient γέμισμα. Flat map (μηδέν nested array) → Firestore-legal αυτούσιο. */
  readonly gradient?: HatchGradient;
}

export interface HatchDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly data: HatchDocData;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface HatchServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface HatchSaveInput {
  readonly id?: string;
  readonly data: HatchDocData;
  readonly layerId?: string;
}

export interface HatchUpdateInput {
  readonly data?: HatchDocData;
  readonly layerId?: string;
}

// ============================================================================
// PURE HELPERS (exported for diffing + tests)
// ============================================================================

/** The scalar hatch fields carried into Firestore (boundaryPaths handled separately). */
const HATCH_SCALAR_KEYS: readonly (keyof HatchDocData)[] = [
  'patternName', 'patternType', 'patternScale', 'patternAngle',
  'seedPoints', 'fillColor', 'backgroundColor', 'associative', 'fillType',
  'islandStyle', 'lineAngle', 'lineSpacing', 'doubleCrossHatch', 'patternOrigin',
  'drawOrder', 'gapTolerance', 'patternSpace', 'transparency',
  // ADR-507 Φ5 — gradient = flat object (όχι nested array) → αποθηκεύεται ως map field
  // με τον ίδιο μηχανισμό (pickHatchData copy + ...scalars spread στο hatchDocToEntity).
  'gradient',
];

/** Runtime hatch shape consumed on the write side (boundaryPaths = Point2D[][]). */
type HatchDataSource = Omit<Partial<HatchDocData>, 'boundaryPaths'> & {
  readonly boundaryPaths?: ReadonlyArray<ReadonlyArray<Point2D>>;
};

/** Serialise the runtime `Point2D[][]` rings to Firestore-legal array-of-maps. */
export function serializeBoundaryPaths(paths: ReadonlyArray<ReadonlyArray<Point2D>>): HatchBoundaryRing[] {
  return paths.map((ring) => ({ vertices: projectVerticesTo2D(ring) }));
}

/** Rehydrate the persisted rings back to the runtime `Point2D[][]` shape. */
export function deserializeBoundaryPaths(rings: ReadonlyArray<HatchBoundaryRing>): Point2D[][] {
  return rings.map((r) => projectVerticesTo2D(r.vertices ?? []));
}

/**
 * Project a `HatchEntity` down to its persistable payload: wraps `boundaryPaths`
 * into Firestore-legal rings (no nested arrays) and drops `undefined` scalar
 * fields (Firestore rejects `undefined`). Doubles as the diff-normaliser so the
 * hook compares like-for-like against `HatchDoc.data`.
 */
export function pickHatchData(entity: HatchDataSource): HatchDocData {
  const out: Record<string, unknown> = {};
  out.boundaryPaths = serializeBoundaryPaths(entity.boundaryPaths ?? []);
  for (const key of HATCH_SCALAR_KEYS) {
    const value = (entity as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out as unknown as HatchDocData;
}

// ============================================================================
// SERVICE
// ============================================================================

export class HatchFirestoreService {
  constructor(private readonly config: HatchServiceConfig) {}

  private docRef(id: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_HATCHES, id);
  }

  subscribeHatches(
    onChange: (docs: readonly HatchDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<HatchDoc>(
      'FLOORPLAN_HATCHES',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  async saveHatch(input: HatchSaveInput): Promise<HatchDoc> {
    const id = input.id ?? generateHatchId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      // ADR-420 — floorplanId (provenance) + floorId (stable scope), from config SSoT.
      ...bimScopeWriteFields(this.config),
      // input.data is already a serialised HatchDocData (rings, no undefined) — see
      // hatchEntityToSaveInput → pickHatchData. Do NOT re-pick (would double-wrap).
      data: input.data,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as HatchDoc;
  }

  async updateHatch(id: string, patch: HatchUpdateInput): Promise<void> {
    const ref = this.docRef(id);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.data !== undefined) payload.data = patch.data;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    await updateDoc(ref, payload);
  }

  async deleteHatch(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createHatchFirestoreService(config: HatchServiceConfig): HatchFirestoreService {
  return new HatchFirestoreService(config);
}

// ============================================================================
// CONVERTERS (pure — entity ↔ doc)
// ============================================================================

export function hatchEntityToSaveInput(entity: HatchEntity): HatchSaveInput {
  return {
    id: entity.id,
    data: pickHatchData(entity),
    layerId: entity.layerId,
  };
}

export function hatchDocToEntity(d: HatchDoc): HatchEntity {
  const { boundaryPaths, ...scalars } = d.data;
  return {
    id: d.id,
    type: 'hatch',
    ...scalars,
    // Rehydrate the persisted array-of-maps rings back to runtime `Point2D[][]`.
    boundaryPaths: deserializeBoundaryPaths(boundaryPaths ?? []),
    layerId: d.layerId,
    visible: true,
  } as HatchEntity;
}
