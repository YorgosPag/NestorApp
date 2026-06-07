'use client';

/**
 * ADR-422 L0 — Thermal-space Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_thermal_spaces/{id}` (companyId-scoped via field +
 * ADR-420 stable floorId scope). Mirrors `FloorFinishFirestoreService` (area entity).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateThermalSpaceId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 * @see ../floor-finishes/floor-finish-firestore-service (το πρότυπο)
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
import { generateThermalSpaceId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  ThermalSpaceEntity,
  ThermalSpaceGeometry,
  ThermalSpaceParams,
  ThermalSpaceUseType,
} from '../types/thermal-space-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

export interface ThermalSpaceDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** = ThermalSpaceUseType (η χρήση χώρου — ο entity kind). */
  readonly kind: ThermalSpaceUseType;
  readonly params: ThermalSpaceParams;
  readonly geometry?: ThermalSpaceGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface ThermalSpaceServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface ThermalSpaceSaveInput {
  readonly id?: string;
  readonly params: ThermalSpaceParams;
  readonly geometry?: ThermalSpaceGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface ThermalSpaceUpdateInput {
  readonly params?: ThermalSpaceParams;
  readonly geometry?: ThermalSpaceGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ThermalSpaceFirestoreService {
  constructor(private readonly config: ThermalSpaceServiceConfig) {}

  private docRef(id: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_THERMAL_SPACES, id);
  }

  subscribeThermalSpaces(
    onChange: (docs: readonly ThermalSpaceDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<ThermalSpaceDoc>(
      'FLOORPLAN_THERMAL_SPACES',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  async saveThermalSpace(input: ThermalSpaceSaveInput): Promise<ThermalSpaceDoc> {
    const id = input.id ?? generateThermalSpaceId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      // ADR-420 — floorplanId (provenance) + floorId (stable scope), from config SSoT.
      ...bimScopeWriteFields(this.config),
      // kind = useType (η χρήση) so docToEntity restores the proper discriminator.
      kind: input.params.useType,
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
    return base as unknown as ThermalSpaceDoc;
  }

  async updateThermalSpace(id: string, patch: ThermalSpaceUpdateInput): Promise<void> {
    const ref = this.docRef(id);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) {
      payload.params = patch.params;
      // keep the doc discriminator in sync with the use type.
      payload.kind = patch.params.useType;
    }
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    await updateDoc(ref, payload);
  }

  async deleteThermalSpace(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createThermalSpaceFirestoreService(
  config: ThermalSpaceServiceConfig,
): ThermalSpaceFirestoreService {
  return new ThermalSpaceFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

export function thermalSpaceEntityToSaveInput(entity: ThermalSpaceEntity): ThermalSpaceSaveInput {
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

export function thermalSpaceDocToEntity(d: ThermalSpaceDoc): ThermalSpaceEntity {
  return {
    id: d.id,
    type: 'thermal-space',
    kind: d.kind,
    ifcType: 'IfcSpace',
    params: d.params,
    geometry:
      d.geometry ?? {
        bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
        area: 0,
        perimeter: 0,
        volume: 0,
      },
    validation: EMPTY_VALIDATION,
    layerId: d.layerId,
    buildingId: d.buildingId,
    floorId: d.floorId,
  } as ThermalSpaceEntity;
}
