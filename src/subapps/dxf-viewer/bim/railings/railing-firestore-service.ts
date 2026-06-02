'use client';

/**
 * ADR-407 — Railing Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_railings/{railingId}` (companyId-scoped via field).
 * Mirrors `MepFixtureFirestoreService`. Re-uses `firestoreQueryService` SSoT
 * (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateRailingId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
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
import { generateRailingId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  RailingEntity,
  RailingGeometry,
  RailingKind,
  RailingParams,
} from '../types/railing-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted railing. Mirrors
 * `MepFixtureDoc`: params + validation persisted; geometry optional
 * (re-derivable from `computeRailingGeometry(params)`).
 */
export interface RailingDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: RailingKind;
  readonly params: RailingParams;
  readonly validation: BimValidation;
  readonly geometry?: RailingGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface RailingFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface RailingSaveInput {
  readonly id?: string;
  readonly kind: RailingKind;
  readonly params: RailingParams;
  readonly validation: BimValidation;
  readonly geometry?: RailingGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface RailingUpdateInput {
  readonly params?: RailingParams;
  readonly validation?: BimValidation;
  readonly geometry?: RailingGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class RailingFirestoreService {
  constructor(private readonly config: RailingFirestoreServiceConfig) {}

  private docRef(railingId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_RAILINGS, railingId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribeRailings(
    onChange: (railings: readonly RailingDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<RailingDoc>(
      'FLOORPLAN_RAILINGS',
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
   * Persist a new railing or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateRailingId()` when no `id` is supplied.
   */
  async saveRailing(input: RailingSaveInput): Promise<RailingDoc> {
    const id = input.id ?? generateRailingId();
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
    return base as unknown as RailingDoc;
  }

  async updateRailing(railingId: string, patch: RailingUpdateInput): Promise<void> {
    const ref = this.docRef(railingId);
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

  async deleteRailing(railingId: string): Promise<void> {
    await deleteDoc(this.docRef(railingId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createRailingFirestoreService(
  config: RailingFirestoreServiceConfig,
): RailingFirestoreService {
  return new RailingFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `RailingEntity` to `RailingSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: RailingEntity): RailingSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
