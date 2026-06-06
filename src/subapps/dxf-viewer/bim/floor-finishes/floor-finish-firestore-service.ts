'use client';

/**
 * ADR-419 — Floor-finish Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_floor_finishes/{id}` (companyId-scoped via field).
 * Mirrors `RoofFirestoreService` (ADR-417) — simpler (no family-type link).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateFloorFinishId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateFloorFinishId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type { FloorFinishEntity, FloorFinishGeometry, FloorFinishParams } from '../types/floor-finish-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

export interface FloorFinishDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: string;
  readonly params: FloorFinishParams;
  readonly geometry?: FloorFinishGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface FloorFinishServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface FloorFinishSaveInput {
  readonly id?: string;
  readonly params: FloorFinishParams;
  readonly geometry?: FloorFinishGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface FloorFinishUpdateInput {
  readonly params?: FloorFinishParams;
  readonly geometry?: FloorFinishGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class FloorFinishFirestoreService {
  constructor(private readonly config: FloorFinishServiceConfig) {}

  private docRef(id: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_FLOOR_FINISHES, id);
  }

  subscribeFloorFinishes(
    onChange: (docs: readonly FloorFinishDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<FloorFinishDoc>(
      'FLOORPLAN_FLOOR_FINISHES',
      (result) => onChange(result.documents),
      onError,
      {
        constraints: [
          where('projectId', '==', this.config.projectId),
          where('floorplanId', '==', this.config.floorplanId),
        ],
      },
    );
  }

  async saveFloorFinish(input: FloorFinishSaveInput): Promise<FloorFinishDoc> {
    const id = input.id ?? generateFloorFinishId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      floorplanId: this.config.floorplanId,
      kind: 'floor-finish',
      params: input.params,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.floorId !== undefined) base.floorId = input.floorId;
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as FloorFinishDoc;
  }

  async updateFloorFinish(id: string, patch: FloorFinishUpdateInput): Promise<void> {
    const ref = this.docRef(id);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    await updateDoc(ref, payload);
  }

  async deleteFloorFinish(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createFloorFinishFirestoreService(
  config: FloorFinishServiceConfig,
): FloorFinishFirestoreService {
  return new FloorFinishFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

export function floorFinishEntityToSaveInput(entity: FloorFinishEntity): FloorFinishSaveInput {
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

export function floorFinishDocToEntity(d: FloorFinishDoc): FloorFinishEntity {
  return {
    id: d.id,
    type: 'floor-finish',
    kind: d.kind,
    ifcType: 'IfcCovering',
    params: d.params,
    geometry: d.geometry ?? { bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, area: 0, perimeter: 0 },
    validation: EMPTY_VALIDATION,
    layerId: d.layerId,
    buildingId: d.buildingId,
    floorId: d.floorId,
  } as FloorFinishEntity;
}
