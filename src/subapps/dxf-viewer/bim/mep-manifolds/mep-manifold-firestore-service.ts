'use client';

/**
 * ADR-408 Φ12 — Plumbing manifold Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_manifolds/{manifoldId}` (companyId-scoped via
 * field). Mirrors `ElectricalPanelFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepManifoldId`) for the
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
import { generateMepManifoldId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  MepManifoldEntity,
  MepManifoldGeometry,
  MepManifoldKind,
  MepManifoldParams,
} from '../types/mep-manifold-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted plumbing manifold. Mirrors
 * `ElectricalPanelDoc`: params + validation persisted; geometry optional
 * (re-derivable from `computeMepManifoldGeometry(params)`).
 */
export interface MepManifoldDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepManifoldKind;
  readonly params: MepManifoldParams;
  readonly validation: BimValidation;
  readonly geometry?: MepManifoldGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepManifoldFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface MepManifoldSaveInput {
  readonly id?: string;
  readonly kind: MepManifoldKind;
  readonly params: MepManifoldParams;
  readonly validation: BimValidation;
  readonly geometry?: MepManifoldGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepManifoldUpdateInput {
  readonly params?: MepManifoldParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepManifoldGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepManifoldFirestoreService {
  constructor(private readonly config: MepManifoldFirestoreServiceConfig) {}

  private docRef(manifoldId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_MANIFOLDS, manifoldId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribeManifolds(
    onChange: (manifolds: readonly MepManifoldDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepManifoldDoc>(
      'FLOORPLAN_MEP_MANIFOLDS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new manifold or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepManifoldId()` when no `id` supplied.
   */
  async saveManifold(input: MepManifoldSaveInput): Promise<MepManifoldDoc> {
    const id = input.id ?? generateMepManifoldId();
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
    return base as unknown as MepManifoldDoc;
  }

  async updateManifold(manifoldId: string, patch: MepManifoldUpdateInput): Promise<void> {
    const ref = this.docRef(manifoldId);
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

  async deleteManifold(manifoldId: string): Promise<void> {
    await deleteDoc(this.docRef(manifoldId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepManifoldFirestoreService(
  config: MepManifoldFirestoreServiceConfig,
): MepManifoldFirestoreService {
  return new MepManifoldFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepManifoldEntity` to `MepManifoldSaveInput`.
 * Re-derivable `geometry` intentionally omitted — recomputed client-side from
 * params on hydrate.
 */
export function entityToSaveInput(entity: MepManifoldEntity): MepManifoldSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
