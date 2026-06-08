'use client';

/**
 * ADR-408 DHW — Domestic hot water heater Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_water_heaters/{waterHeaterId}` (companyId-scoped via
 * field). Mirrors `MepBoilerFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepWaterHeaterId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
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
import { generateMepWaterHeaterId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  MepWaterHeaterEntity,
  MepWaterHeaterGeometry,
  MepWaterHeaterKind,
  MepWaterHeaterParams,
} from '../types/mep-water-heater-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted domestic hot water heater. Mirrors
 * `MepBoilerDoc`: params + validation persisted; geometry optional (re-derivable
 * from `computeMepWaterHeaterGeometry(params)`).
 */
export interface MepWaterHeaterDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepWaterHeaterKind;
  readonly params: MepWaterHeaterParams;
  readonly validation: BimValidation;
  readonly geometry?: MepWaterHeaterGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepWaterHeaterFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface MepWaterHeaterSaveInput {
  readonly id?: string;
  readonly kind: MepWaterHeaterKind;
  readonly params: MepWaterHeaterParams;
  readonly validation: BimValidation;
  readonly geometry?: MepWaterHeaterGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepWaterHeaterUpdateInput {
  readonly params?: MepWaterHeaterParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepWaterHeaterGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepWaterHeaterFirestoreService {
  constructor(private readonly config: MepWaterHeaterFirestoreServiceConfig) {}

  private docRef(waterHeaterId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_WATER_HEATERS, waterHeaterId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant `companyId`
   * auto-applied by `firestoreQueryService`.
   */
  subscribeWaterHeaters(
    onChange: (waterHeaters: readonly MepWaterHeaterDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepWaterHeaterDoc>(
      'FLOORPLAN_MEP_WATER_HEATERS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new water heater or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepWaterHeaterId()` when no `id` supplied.
   */
  async saveWaterHeater(input: MepWaterHeaterSaveInput): Promise<MepWaterHeaterDoc> {
    const id = input.id ?? generateMepWaterHeaterId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      // ADR-420 — floorplanId (provenance) + floorId (stable scope), from config SSoT.
      ...bimScopeWriteFields(this.config),
      kind: input.kind,
      params: input.params,
      validation: input.validation,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    // Firestore rejects `undefined` — include optional fields only when set.
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    // ADR-420 — floorId is owned by config scope (bimScopeWriteFields above), not input.
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as MepWaterHeaterDoc;
  }

  async updateWaterHeater(waterHeaterId: string, patch: MepWaterHeaterUpdateInput): Promise<void> {
    const ref = this.docRef(waterHeaterId);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;

    await updateDoc(ref, payload);
  }

  async deleteWaterHeater(waterHeaterId: string): Promise<void> {
    await deleteDoc(this.docRef(waterHeaterId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepWaterHeaterFirestoreService(
  config: MepWaterHeaterFirestoreServiceConfig,
): MepWaterHeaterFirestoreService {
  return new MepWaterHeaterFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepWaterHeaterEntity` to `MepWaterHeaterSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: MepWaterHeaterEntity): MepWaterHeaterSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
