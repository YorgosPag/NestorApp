'use client';

/**
 * ADR-417 — Roof Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_roofs/{roofId}` (companyId-scoped via field).
 * Mirrors `RailingFirestoreService` (ADR-407). Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateRoofId`) για το
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import {
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateRoofId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  RoofEntity,
  RoofGeometry,
  RoofKind,
  RoofParams,
} from '../types/roof-types';
import type { RoofTypeParams } from '../types/bim-family-type';
import type { BimValidation } from '../types/bim-base';
import type { FaceAppearanceMap } from '../types/face-appearance-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για ένα persisted roof. Mirrors
 * `RailingDoc`: params + validation persisted· geometry optional
 * (re-derivable από `computeRoofGeometry(params)`).
 */
export interface RoofDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: RoofKind;
  readonly params: RoofParams;
  readonly validation: BimValidation;
  readonly geometry?: RoofGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-417 §10 #3 — FK → BimFamilyType.id (RoofType). Absent on untyped roofs. */
  readonly typeId?: string;
  /** ADR-417 §10 #3 — per-instance overrides of type-level params. */
  readonly typeOverrides?: Partial<RoofTypeParams>;
  /** ADR-539 Φ3b — per-«νερό» appearance override (Cinema 4D «Polygon Mode»). */
  readonly faceAppearance?: FaceAppearanceMap;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface RoofFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface RoofSaveInput {
  readonly id?: string;
  readonly kind: RoofKind;
  readonly params: RoofParams;
  readonly validation: BimValidation;
  readonly geometry?: RoofGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly typeId?: string;
  readonly typeOverrides?: Partial<RoofTypeParams>;
  /** ADR-539 Φ3b — per-«νερό» appearance override (Cinema 4D «Polygon Mode»). */
  readonly faceAppearance?: FaceAppearanceMap;
}

export interface RoofUpdateInput {
  readonly params?: RoofParams;
  readonly validation?: BimValidation;
  readonly geometry?: RoofGeometry;
  readonly layerId?: string;
  /** `null` → `deleteField()` (non-destructive detach keeps params; ADR-412 Q6). */
  readonly typeId?: string | null;
  /** `null` → `deleteField()` (clear all per-instance overrides). */
  readonly typeOverrides?: Partial<RoofTypeParams> | null;
  /**
   * ADR-539 Φ3b — per-«νερό» appearance edit on an EXISTING roof. The faced paint fires
   * `bim:entities-attached` → persist → `updateRoof` (non-first writes use updateDoc), so
   * the patch MUST carry it or the painted νερά would be lost on reload (mirror foundation/column).
   */
  readonly faceAppearance?: FaceAppearanceMap;
}

// ============================================================================
// SERVICE
// ============================================================================

export class RoofFirestoreService {
  constructor(private readonly config: RoofFirestoreServiceConfig) {}

  private docRef(roofId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_ROOFS, roofId);
  }

  /**
   * Real-time subscription scoped σε `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied από `firestoreQueryService`.
   */
  subscribeRoofs(
    onChange: (roofs: readonly RoofDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<RoofDoc>(
      'FLOORPLAN_ROOFS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist νέα στέγη ή overwrite υπάρχουσας (id-preserving).
   * Enterprise-id (SOS N.6): `generateRoofId()` όταν δεν υπάρχει `id`.
   */
  async saveRoof(input: RoofSaveInput): Promise<RoofDoc> {
    const id = input.id ?? generateRoofId();
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
    // `setDoc` REPLACES the doc, so omitting `typeId`/`typeOverrides` on a detach
    // removes them (non-destructive — params kept; ADR-412 Q6).
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.layerId !== undefined) base.layerId = input.layerId;
    if (input.typeId !== undefined) base.typeId = input.typeId;
    if (input.typeOverrides !== undefined) base.typeOverrides = input.typeOverrides;
    // ADR-539 Φ3b — persist per-«νερό» appearance (Firestore rejects undefined).
    if (input.faceAppearance !== undefined) base.faceAppearance = input.faceAppearance;

    await setDoc(ref, base);
    return base as unknown as RoofDoc;
  }

  async updateRoof(roofId: string, patch: RoofUpdateInput): Promise<void> {
    const ref = this.docRef(roofId);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    // `null` deletes the field (detach / clear overrides); a value writes it.
    if (patch.typeId !== undefined) {
      payload.typeId = patch.typeId === null ? deleteField() : patch.typeId;
    }
    if (patch.typeOverrides !== undefined) {
      payload.typeOverrides = patch.typeOverrides === null ? deleteField() : patch.typeOverrides;
    }
    // ADR-539 Φ3b — persist per-«νερό» appearance edit (Firestore rejects undefined).
    if (patch.faceAppearance !== undefined) payload.faceAppearance = patch.faceAppearance;

    await updateDoc(ref, payload);
  }

  async deleteRoof(roofId: string): Promise<void> {
    await deleteDoc(this.docRef(roofId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createRoofFirestoreService(
  config: RoofFirestoreServiceConfig,
): RoofFirestoreService {
  return new RoofFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `RoofEntity` σε `RoofSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side από params on hydrate.
 */
export function entityToSaveInput(entity: RoofEntity): RoofSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
    // ADR-417 §10 #3 — persist the family-type link. Omitted (undefined) for
    // untyped/legacy roofs so `setDoc` writes no `typeId`/`typeOverrides`.
    ...(entity.typeId !== undefined && { typeId: entity.typeId }),
    ...(entity.typeOverrides !== undefined && { typeOverrides: entity.typeOverrides }),
    // ADR-539 Φ3b — carry per-«νερό» appearance into the persisted doc (round-trip).
    ...(entity.faceAppearance !== undefined && { faceAppearance: entity.faceAppearance }),
  };
}
