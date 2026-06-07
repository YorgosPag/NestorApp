'use client';

/**
 * ADR-408 Εύρος Β #3 — Underfloor heating loop Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_underfloors/{underfloorId}` (companyId-scoped via
 * field). Mirrors `MepBoilerFirestoreService`. Re-uses `firestoreQueryService` SSoT
 * (ADR-355) + ADR-420 floor-scope constraints.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepUnderfloorId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT ratchet.
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
import { generateMepUnderfloorId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  MepUnderfloorEntity,
  MepUnderfloorGeometry,
  MepUnderfloorKind,
  MepUnderfloorParams,
} from '../types/mep-underfloor-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted underfloor loop. Mirrors
 * `MepBoilerDoc`: params + validation persisted; geometry optional (re-derivable
 * from `computeMepUnderfloorGeometry(params)`).
 */
export interface MepUnderfloorDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepUnderfloorKind;
  readonly params: MepUnderfloorParams;
  readonly validation: BimValidation;
  readonly geometry?: MepUnderfloorGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepUnderfloorFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface MepUnderfloorSaveInput {
  readonly id?: string;
  readonly kind: MepUnderfloorKind;
  readonly params: MepUnderfloorParams;
  readonly validation: BimValidation;
  readonly geometry?: MepUnderfloorGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepUnderfloorUpdateInput {
  readonly params?: MepUnderfloorParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepUnderfloorGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepUnderfloorFirestoreService {
  constructor(private readonly config: MepUnderfloorFirestoreServiceConfig) {}

  private docRef(underfloorId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_UNDERFLOORS, underfloorId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId/floorId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribeUnderfloors(
    onChange: (underfloors: readonly MepUnderfloorDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepUnderfloorDoc>(
      'FLOORPLAN_MEP_UNDERFLOORS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new underfloor or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepUnderfloorId()` when no `id` supplied.
   */
  async saveUnderfloor(input: MepUnderfloorSaveInput): Promise<MepUnderfloorDoc> {
    const id = input.id ?? generateMepUnderfloorId();
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
    return base as unknown as MepUnderfloorDoc;
  }

  async updateUnderfloor(underfloorId: string, patch: MepUnderfloorUpdateInput): Promise<void> {
    const ref = this.docRef(underfloorId);
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

  async deleteUnderfloor(underfloorId: string): Promise<void> {
    await deleteDoc(this.docRef(underfloorId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepUnderfloorFirestoreService(
  config: MepUnderfloorFirestoreServiceConfig,
): MepUnderfloorFirestoreService {
  return new MepUnderfloorFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepUnderfloorEntity` to `MepUnderfloorSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: MepUnderfloorEntity): MepUnderfloorSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
