'use client';

/**
 * ADR-408 Φ11 — MEP fitting Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_fittings/{fittingId}` (companyId-scoped via
 * field). Mirrors `MepSegmentFirestoreService` (ADR-408 Φ8).
 * Re-uses `firestoreQueryService` SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepFittingId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
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
import { generateMepFittingId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  MepFittingEntity,
  MepFittingGeometry,
  MepFittingKind,
  MepFittingParams,
} from '../types/mep-fitting-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted MEP fitting. Mirrors
 * `MepSegmentDoc`: params + validation persisted; geometry optional
 * (re-derivable from `computeMepFittingGeometry(params)`).
 */
export interface MepFittingDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepFittingKind;
  readonly params: MepFittingParams;
  readonly validation: BimValidation;
  readonly geometry?: MepFittingGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepFittingFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface MepFittingSaveInput {
  readonly id?: string;
  readonly kind: MepFittingKind;
  readonly params: MepFittingParams;
  readonly validation: BimValidation;
  readonly geometry?: MepFittingGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepFittingUpdateInput {
  readonly params?: MepFittingParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepFittingGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepFittingFirestoreService {
  constructor(private readonly config: MepFittingFirestoreServiceConfig) {}

  private docRef(fittingId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_FITTINGS, fittingId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribeFittings(
    onChange: (fittings: readonly MepFittingDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepFittingDoc>(
      'FLOORPLAN_MEP_FITTINGS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new fitting or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepFittingId()` when no `id` supplied.
   */
  async saveFitting(input: MepFittingSaveInput): Promise<MepFittingDoc> {
    const id = input.id ?? generateMepFittingId();
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
    return base as unknown as MepFittingDoc;
  }

  async updateFitting(fittingId: string, patch: MepFittingUpdateInput): Promise<void> {
    const ref = this.docRef(fittingId);
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

  async deleteFitting(fittingId: string): Promise<void> {
    await deleteDoc(this.docRef(fittingId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepFittingFirestoreService(
  config: MepFittingFirestoreServiceConfig,
): MepFittingFirestoreService {
  return new MepFittingFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepFittingEntity` to `MepFittingSaveInput`.
 * Re-derivable `geometry` intentionally omitted — recomputed client-side from
 * params on hydrate.
 */
export function entityToSaveInput(entity: MepFittingEntity): MepFittingSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
