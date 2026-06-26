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
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateSlabId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  SlabEntity,
  SlabGeometry,
  SlabKind,
  SlabParams,
} from '../types/slab-types';
import type { SlabTypeParams } from '../types/bim-family-type';
import type { BimValidation } from '../types/bim-base';
import type { GuideBinding } from '../hosting/guide-binding-types';
import type { FaceAppearanceMap } from '../types/face-appearance-types';

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
  /** ADR-412 — FK → BimFamilyType.id. Absent on legacy/untyped slabs. */
  readonly typeId?: string;
  /** ADR-412 — per-instance overrides of type-level slab params. */
  readonly typeOverrides?: Partial<SlabTypeParams>;
  /** ADR-441 Slice GEN-SLAB — grid hosting bindings (born-bound πλάκες φατνώματος από κάναβο). */
  readonly guideBindings?: readonly GuideBinding[];
  /** ADR-539 — per-face appearance override (Cinema 4D «Polygon Mode»). */
  readonly faceAppearance?: FaceAppearanceMap;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface SlabFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
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
  /** ADR-412 — family-type link (FK + per-instance overrides). */
  readonly typeId?: string;
  readonly typeOverrides?: Partial<SlabTypeParams>;
  /** ADR-441 Slice GEN-SLAB — grid hosting bindings (born-bound πλάκες φατνώματος). */
  readonly guideBindings?: readonly GuideBinding[];
  /** ADR-539 — per-face appearance override (Cinema 4D «Polygon Mode»). */
  readonly faceAppearance?: FaceAppearanceMap;
}

export interface SlabUpdateInput {
  readonly params?: SlabParams;
  readonly validation?: BimValidation;
  readonly geometry?: SlabGeometry;
  readonly layerId?: string;
  /** ADR-441 Slice GEN-SLAB — re-host bindings update (Firestore rejects undefined). */
  readonly guideBindings?: readonly GuideBinding[];
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
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
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

    // Firestore rejects `undefined` — include optional fields μόνο όταν set.
    // `setDoc` REPLACES the doc, so omitting `typeId`/`typeOverrides` on a
    // detach removes them (non-destructive — params kept; ADR-412 Q6).
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    // ADR-420 — floorId is owned by config scope (bimScopeWriteFields above), not input.
    if (input.layerId !== undefined) base.layerId = input.layerId;
    if (input.typeId !== undefined) base.typeId = input.typeId;
    if (input.typeOverrides !== undefined) base.typeOverrides = input.typeOverrides;
    // ADR-441 Slice GEN-SLAB — persist grid hosting bindings (Firestore rejects undefined).
    if (input.guideBindings !== undefined) base.guideBindings = input.guideBindings;
    // ADR-539 — persist per-face appearance (Firestore rejects undefined).
    if (input.faceAppearance !== undefined) base.faceAppearance = input.faceAppearance;

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
    if (patch.guideBindings !== undefined) payload.guideBindings = patch.guideBindings;

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
    // ADR-412 — carry the family-type link so a typed slab round-trips its
    // `typeId`/overrides. Omitted (undefined) for untyped/legacy slabs.
    ...(entity.typeId !== undefined && { typeId: entity.typeId }),
    ...(entity.typeOverrides !== undefined && { typeOverrides: entity.typeOverrides }),
    // ADR-441 Slice GEN-SLAB — carry grid hosting bindings into the persisted doc.
    ...(entity.guideBindings !== undefined && { guideBindings: entity.guideBindings }),
    // ADR-539 — carry per-face appearance into the persisted doc (round-trip).
    ...(entity.faceAppearance !== undefined && { faceAppearance: entity.faceAppearance }),
  };
}
