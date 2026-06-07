'use client';

/**
 * ADR-363 Phase 3.7 — Slab-Opening Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_slab_openings/{slabOpeningId}` (companyId-scoped
 * via field). Mirrors `SlabFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_SLAB_OPENINGS',...)`
 * με `(projectId, floorplanId)` constraints. Tenant `companyId` auto-applied.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateSlabOpeningId`) για
 * enterprise-id contract (SOS N.6). Auto-id writes απαγορεύονται από SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10 §11.Q3
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
import { generateSlabOpeningId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  SlabOpeningEntity,
  SlabOpeningGeometry,
  SlabOpeningKind,
  SlabOpeningParams,
} from '../types/slab-opening-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για persisted slab-opening. Mirrors
 * `SlabDoc`: params + validation persisted; geometry optional (re-derivable
 * από `computeSlabOpeningGeometry(params)`).
 */
export interface SlabOpeningDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: SlabOpeningKind;
  readonly params: SlabOpeningParams;
  readonly validation: BimValidation;
  readonly geometry?: SlabOpeningGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface SlabOpeningFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface SlabOpeningSaveInput {
  readonly id?: string;
  readonly kind: SlabOpeningKind;
  readonly params: SlabOpeningParams;
  readonly validation: BimValidation;
  readonly geometry?: SlabOpeningGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface SlabOpeningUpdateInput {
  readonly params?: SlabOpeningParams;
  readonly validation?: BimValidation;
  readonly geometry?: SlabOpeningGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class SlabOpeningFirestoreService {
  constructor(private readonly config: SlabOpeningFirestoreServiceConfig) {}

  private docRef(slabOpeningId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_SLAB_OPENINGS, slabOpeningId);
  }

  /**
   * Real-time subscription scoped σε `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied από `firestoreQueryService`. ADR-361 equality
   * guard upstream → no idle re-render storms.
   */
  subscribeSlabOpenings(
    onChange: (docs: readonly SlabOpeningDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<SlabOpeningDoc>(
      'FLOORPLAN_SLAB_OPENINGS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new slab-opening ή overwrite υπάρχουσα (id-preserving). Audit:
   * `createdBy/createdAt` σε first write μόνο, `updatedBy/updatedAt` πάντα.
   *
   * Enterprise-id (SOS N.6): `generateSlabOpeningId()` όταν δεν δοθεί `id`.
   */
  async saveSlabOpening(input: SlabOpeningSaveInput): Promise<SlabOpeningDoc> {
    const id = input.id ?? generateSlabOpeningId();
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

    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    // ADR-420 — floorId is owned by config scope (bimScopeWriteFields above), not input.
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as SlabOpeningDoc;
  }

  async updateSlabOpening(
    slabOpeningId: string,
    patch: SlabOpeningUpdateInput,
  ): Promise<void> {
    const ref = this.docRef(slabOpeningId);
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

  async deleteSlabOpening(slabOpeningId: string): Promise<void> {
    await deleteDoc(this.docRef(slabOpeningId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createSlabOpeningFirestoreService(
  config: SlabOpeningFirestoreServiceConfig,
): SlabOpeningFirestoreService {
  return new SlabOpeningFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert scene-side `SlabOpeningEntity` σε `SlabOpeningSaveInput`.
 * Geometry intentionally omitted — recomputed client-side από params on
 * hydrate (re-derivable).
 */
export function entityToSaveInput(
  entity: SlabOpeningEntity,
): SlabOpeningSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
