'use client';

/**
 * ADR-511 — Wall-covering Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_wall_coverings/{id}` (companyId-scoped via field, floor-scoped
 * via ADR-420 `floorId`/`floorplanId`). Mirrors `FloorFinishFirestoreService` (ADR-419):
 * αποθηκεύει `params` + `geometry` απευθείας (το `layers[]` είναι array-of-maps →
 * Firestore-legal, ΟΧΙ nested array). Το `kind` derive-άρεται από το assembly.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateWallCoveringId`) για το enterprise-id
 * contract (SOS N.6). Auto-id writes απαγορεύονται από το SSoT ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see bim/floor-finishes/floor-finish-firestore-service.ts — το πρότυπο
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
import { generateWallCoveringId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import {
  resolveWallCoveringKind,
  type WallCoveringEntity,
  type WallCoveringGeometry,
  type WallCoveringKind,
  type WallCoveringParams,
} from '../types/wall-covering-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

export interface WallCoveringDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: WallCoveringKind;
  readonly params: WallCoveringParams;
  readonly geometry?: WallCoveringGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface WallCoveringServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface WallCoveringSaveInput {
  readonly id?: string;
  readonly params: WallCoveringParams;
  readonly geometry?: WallCoveringGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface WallCoveringUpdateInput {
  readonly params?: WallCoveringParams;
  readonly geometry?: WallCoveringGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class WallCoveringFirestoreService {
  constructor(private readonly config: WallCoveringServiceConfig) {}

  private docRef(id: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_WALL_COVERINGS, id);
  }

  subscribeWallCoverings(
    onChange: (docs: readonly WallCoveringDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<WallCoveringDoc>(
      'FLOORPLAN_WALL_COVERINGS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  async saveWallCovering(input: WallCoveringSaveInput): Promise<WallCoveringDoc> {
    const id = input.id ?? generateWallCoveringId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      // ADR-420 — floorplanId (provenance) + floorId (stable scope), from config SSoT.
      ...bimScopeWriteFields(this.config),
      kind: resolveWallCoveringKind(input.params.layers),
      params: input.params,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as WallCoveringDoc;
  }

  async updateWallCovering(id: string, patch: WallCoveringUpdateInput): Promise<void> {
    const ref = this.docRef(id);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) {
      payload.params = patch.params;
      payload.kind = resolveWallCoveringKind(patch.params.layers);
    }
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    await updateDoc(ref, payload);
  }

  async deleteWallCovering(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createWallCoveringFirestoreService(
  config: WallCoveringServiceConfig,
): WallCoveringFirestoreService {
  return new WallCoveringFirestoreService(config);
}

// ============================================================================
// HELPERS (pure — entity ↔ doc)
// ============================================================================

export function wallCoveringEntityToSaveInput(entity: WallCoveringEntity): WallCoveringSaveInput {
  return {
    id: entity.id,
    params: entity.params,
    geometry: entity.geometry,
    layerId: entity.layerId,
  };
}

const EMPTY_VALIDATION: BimValidation = {
  hasCodeViolations: false,
  violationKeys: [],
  lastValidatedAt: null,
};

const EMPTY_GEOMETRY: WallCoveringGeometry = {
  lengthM: 0,
  heightM: 0,
  areaM2: 0,
  totalThicknessMm: 0,
};

export function wallCoveringDocToEntity(d: WallCoveringDoc): WallCoveringEntity {
  return {
    id: d.id,
    type: 'wall-covering',
    kind: d.kind ?? resolveWallCoveringKind(d.params.layers),
    ifcType: 'IfcCovering',
    params: d.params,
    geometry: d.geometry ?? EMPTY_GEOMETRY,
    validation: EMPTY_VALIDATION,
    layerId: d.layerId,
    buildingId: d.buildingId,
    floorId: d.floorId,
  } as WallCoveringEntity;
}
