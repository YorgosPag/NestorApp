'use client';

/**
 * ADR-363 Phase 3 — Slab Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_slabs/{slabId}` (companyId-scoped via field).
 * Mirrors `WallFirestoreService` / `OpeningFirestoreService`. Re-uses
 * `firestoreQueryService.subscribe` SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_SLABS', ...)` με
 * `(projectId, floorplanId)` constraints. Tenant `companyId` εφαρμόζεται
 * αυτόματα.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateSlabId`) για enterprise-id
 * contract (SOS N.6). Auto-id writes απαγορεύονται από SSoT ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
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
import { generateSlabId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  SlabEntity,
  SlabGeometry,
  SlabKind,
  SlabParams,
} from '../types/slab-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για a persisted slab. Mirrors
 * `WallDoc`: params + validation persisted; geometry optional (re-derivable
 * από `computeSlabGeometry(params)`).
 */
export interface SlabDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: SlabKind;
  readonly params: SlabParams;
  readonly validation: BimValidation;
  readonly geometry?: SlabGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface SlabFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface SlabSaveInput {
  readonly id?: string;
  readonly kind: SlabKind;
  readonly params: SlabParams;
  readonly validation: BimValidation;
  readonly geometry?: SlabGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface SlabUpdateInput {
  readonly params?: SlabParams;
  readonly validation?: BimValidation;
  readonly geometry?: SlabGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class SlabFirestoreService {
  constructor(private readonly config: SlabFirestoreServiceConfig) {}

  private docRef(slabId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_SLABS, slabId);
  }

  /**
   * Real-time subscription scoped σε `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied από `firestoreQueryService`. ADR-361 equality
   * guard upstream → no idle re-render storms.
   */
  subscribeSlabs(
    onChange: (slabs: readonly SlabDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<SlabDoc>(
      'FLOORPLAN_SLABS',
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
   * Persist a new slab ή overwrite υπάρχουσα (id-preserving). Audit fields:
   * `createdBy/createdAt` set μόνο σε first write, `updatedBy/updatedAt`
   * refresh every call.
   *
   * Enterprise-id (SOS N.6): `generateSlabId()` όταν δεν δοθεί `id`.
   */
  async saveSlab(input: SlabSaveInput): Promise<SlabDoc> {
    const id = input.id ?? generateSlabId();
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

    // Firestore rejects `undefined` — include optional fields μόνο όταν set.
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.floorId !== undefined) base.floorId = input.floorId;
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as SlabDoc;
  }

  async updateSlab(slabId: string, patch: SlabUpdateInput): Promise<void> {
    const ref = this.docRef(slabId);
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

  async deleteSlab(slabId: string): Promise<void> {
    await deleteDoc(this.docRef(slabId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createSlabFirestoreService(
  config: SlabFirestoreServiceConfig,
): SlabFirestoreService {
  return new SlabFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `SlabEntity` σε `SlabSaveInput`. Re-derivable fields
 * (`geometry`) intentionally omitted — geometry recomputed client-side από
 * params on hydrate.
 */
export function entityToSaveInput(entity: SlabEntity): SlabSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
