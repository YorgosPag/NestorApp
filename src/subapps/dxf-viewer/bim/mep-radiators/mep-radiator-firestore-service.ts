'use client';

/**
 * ADR-408 Εύρος Β #1 — Heating radiator Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_radiators/{radiatorId}` (companyId-scoped via
 * field). Mirrors `MepManifoldFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepRadiatorId`) for the
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
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateMepRadiatorId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  MepRadiatorEntity,
  MepRadiatorGeometry,
  MepRadiatorKind,
  MepRadiatorParams,
} from '../types/mep-radiator-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted heating radiator. Mirrors
 * `MepManifoldDoc`: params + validation persisted; geometry optional (re-derivable
 * from `computeMepRadiatorGeometry(params)`).
 */
export interface MepRadiatorDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepRadiatorKind;
  readonly params: MepRadiatorParams;
  readonly validation: BimValidation;
  readonly geometry?: MepRadiatorGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepRadiatorFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface MepRadiatorSaveInput {
  readonly id?: string;
  readonly kind: MepRadiatorKind;
  readonly params: MepRadiatorParams;
  readonly validation: BimValidation;
  readonly geometry?: MepRadiatorGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepRadiatorUpdateInput {
  readonly params?: MepRadiatorParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepRadiatorGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepRadiatorFirestoreService {
  constructor(private readonly config: MepRadiatorFirestoreServiceConfig) {}

  private docRef(radiatorId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_RADIATORS, radiatorId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant `companyId`
   * auto-applied by `firestoreQueryService`.
   */
  subscribeRadiators(
    onChange: (radiators: readonly MepRadiatorDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepRadiatorDoc>(
      'FLOORPLAN_MEP_RADIATORS',
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

  /**
   * Persist a new radiator or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepRadiatorId()` when no `id` supplied.
   */
  async saveRadiator(input: MepRadiatorSaveInput): Promise<MepRadiatorDoc> {
    const id = input.id ?? generateMepRadiatorId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      floorplanId: this.config.floorplanId,
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
    if (input.floorId !== undefined) base.floorId = input.floorId;
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as MepRadiatorDoc;
  }

  async updateRadiator(radiatorId: string, patch: MepRadiatorUpdateInput): Promise<void> {
    const ref = this.docRef(radiatorId);
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

  async deleteRadiator(radiatorId: string): Promise<void> {
    await deleteDoc(this.docRef(radiatorId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepRadiatorFirestoreService(
  config: MepRadiatorFirestoreServiceConfig,
): MepRadiatorFirestoreService {
  return new MepRadiatorFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepRadiatorEntity` to `MepRadiatorSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: MepRadiatorEntity): MepRadiatorSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
