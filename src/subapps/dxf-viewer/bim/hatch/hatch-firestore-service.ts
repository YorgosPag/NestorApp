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
import type { Point2D } from '../../rendering/types/Types';
import type { HatchEntity } from '../../types/entities';

// ============================================================================
// TYPES
// ============================================================================

/**
 * The persistable hatch payload — the flat DXF hatch fields (NO BaseEntity styling
 * beyond `fillColor`, NO kind/params/geometry). This is the single diff unit
 * (mirror of floor-finish `params`).
 */
export interface HatchDocData {
  readonly boundaryPaths: Point2D[][];
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
  readonly patternOrigin?: Point2D;
  readonly drawOrder?: 0 | 1 | 2 | 3 | 4;
  readonly gapTolerance?: number;
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

/** The hatch-specific keys carried into Firestore (ordered, single SSoT). */
const HATCH_DATA_KEYS: readonly (keyof HatchDocData)[] = [
  'boundaryPaths', 'patternName', 'patternType', 'patternScale', 'patternAngle',
  'seedPoints', 'fillColor', 'backgroundColor', 'associative', 'fillType',
  'islandStyle', 'lineAngle', 'lineSpacing', 'doubleCrossHatch', 'patternOrigin',
  'drawOrder', 'gapTolerance',
];

/**
 * Project a `HatchEntity` down to its persistable payload, dropping `undefined`
 * fields (Firestore rejects `undefined`). Doubles as the diff-normaliser so the
 * hook compares like-for-like against `HatchDoc.data`.
 */
export function pickHatchData(entity: Pick<HatchEntity, keyof HatchDocData>): HatchDocData {
  const out: Record<string, unknown> = {};
  for (const key of HATCH_DATA_KEYS) {
    const value = (entity as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  // boundaryPaths is required — guarantee at least an empty array.
  if (out.boundaryPaths === undefined) out.boundaryPaths = [];
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
      data: pickHatchData(input.data as Pick<HatchEntity, keyof HatchDocData>),
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
    if (patch.data !== undefined) {
      payload.data = pickHatchData(patch.data as Pick<HatchEntity, keyof HatchDocData>);
    }
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
  return {
    id: d.id,
    type: 'hatch',
    ...d.data,
    layerId: d.layerId,
    visible: true,
  } as HatchEntity;
}
