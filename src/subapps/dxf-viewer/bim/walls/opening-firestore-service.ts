'use client';

/**
 * ADR-363 Phase 2 — Opening Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_openings/{openingId}` (companyId-scoped via field).
 * Mirrors `WallFirestoreService` (ADR-363 §5.10) — top-level collection με
 * `companyId` field-based tenant isolation. Reuses `firestoreQueryService.
 * subscribe` SSoT (ADR-355) και την built-in equality guard (ADR-361).
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_OPENINGS', ...)` με
 * `(projectId, floorplanId)` constraints. Tenant `companyId` εφαρμόζεται
 * αυτόματα από το service.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateOpeningId`) για να μην
 * παραβιαστεί το enterprise-id contract (SOS N.6) και τα audit fields
 * (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`). Auto-id writes
 * (`addDoc`) απαγορεύονται από το pre-commit SSoT ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 * @see docs/centralized-systems/reference/adrs/ADR-355-realtime-subscription-ssot-consolidation.md
 * @see docs/centralized-systems/reference/adrs/ADR-361-firestore-subscribe-equality-guard.md
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
import { generateOpeningId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  OpeningEntity,
  OpeningGeometry,
  OpeningKind,
  OpeningParams,
} from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για a persisted opening. Mirrors
 * `WallDoc`: params + validation are persisted; geometry is optional
 * (re-derivable από `computeOpeningGeometry(params, hostWall)`).
 */
export interface OpeningDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: OpeningKind;
  readonly params: OpeningParams;
  readonly validation: BimValidation;
  readonly geometry?: OpeningGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-421 SLICE C — Family/Type link (FK → BimFamilyType.id). */
  readonly typeId?: string;
  /** ADR-421 SLICE C — per-instance overrides of type-level params. */
  readonly typeOverrides?: Partial<OpeningTypeParams>;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface OpeningFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface OpeningSaveInput {
  readonly id?: string;
  readonly kind: OpeningKind;
  readonly params: OpeningParams;
  readonly validation: BimValidation;
  readonly geometry?: OpeningGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-421 SLICE C — Family/Type link. */
  readonly typeId?: string;
  readonly typeOverrides?: Partial<OpeningTypeParams>;
}

export interface OpeningUpdateInput {
  readonly kind?: OpeningKind;
  readonly params?: OpeningParams;
  readonly validation?: BimValidation;
  readonly geometry?: OpeningGeometry;
  readonly layerId?: string;
  /**
   * ADR-421 SLICE C — Family/Type link. `null` → `deleteField()` (detach to
   * ad-hoc / clear all overrides); `undefined` → field untouched in the patch.
   */
  readonly typeId?: string | null;
  readonly typeOverrides?: Partial<OpeningTypeParams> | null;
}

// ============================================================================
// SERVICE
// ============================================================================

export class OpeningFirestoreService {
  constructor(private readonly config: OpeningFirestoreServiceConfig) {}

  private docRef(openingId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_OPENINGS, openingId);
  }

  /**
   * Real-time subscription scoped to current `(projectId, floorplanId)`.
   * Tenant `companyId` auto-applied από `firestoreQueryService`. ADR-361
   * equality guard prevents idle re-render storms.
   */
  subscribeOpenings(
    onChange: (openings: readonly OpeningDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<OpeningDoc>(
      'FLOORPLAN_OPENINGS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new opening ή overwrite existing one (id-preserving). Audit
   * fields: `createdBy/createdAt` set μόνο σε first write, `updatedBy/
   * updatedAt` refresh every call.
   *
   * Enterprise-id (SOS N.6): `generateOpeningId()` όταν δεν δοθεί `id`.
   */
  async saveOpening(input: OpeningSaveInput): Promise<OpeningDoc> {
    const id = input.id ?? generateOpeningId();
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
    // ADR-421 SLICE C — Family/Type link (omitted when ad-hoc/untyped).
    if (input.typeId !== undefined) base.typeId = input.typeId;
    if (input.typeOverrides !== undefined) base.typeOverrides = input.typeOverrides;

    await setDoc(ref, base);
    return base as unknown as OpeningDoc;
  }

  async updateOpening(openingId: string, patch: OpeningUpdateInput): Promise<void> {
    const ref = this.docRef(openingId);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.kind !== undefined) payload.kind = patch.kind;
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    // ADR-421 SLICE C — `null` clears the field (detach / reset overrides),
    // `undefined` leaves it untouched; a value writes it.
    if (patch.typeId === null) payload.typeId = deleteField();
    else if (patch.typeId !== undefined) payload.typeId = patch.typeId;
    if (patch.typeOverrides === null) payload.typeOverrides = deleteField();
    else if (patch.typeOverrides !== undefined) payload.typeOverrides = patch.typeOverrides;

    await updateDoc(ref, payload);
  }

  async deleteOpening(openingId: string): Promise<void> {
    await deleteDoc(this.docRef(openingId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createOpeningFirestoreService(
  config: OpeningFirestoreServiceConfig,
): OpeningFirestoreService {
  return new OpeningFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `OpeningEntity` σε `OpeningSaveInput`. Re-derivable
 * fields (`geometry`) intentionally omitted — geometry recomputed client-side
 * από params + host wall on hydrate.
 */
export function entityToSaveInput(entity: OpeningEntity): OpeningSaveInput {
  return {
    id: entity.id,
    // ADR-363 §5.4 — persist `kind` DERIVED from `params.kind` (single source of
    // truth). Never read the top-level `entity.kind` here: a stale denormalized
    // copy (e.g. after a kind change that only patched `params`) would otherwise
    // diverge `doc.kind` from `doc.params.kind` and break the renderer overlay.
    // ADR-420 — floorId removed from input: it is owned by OpeningFirestoreServiceConfig
    // (via bimScopeWriteFields) and no longer passed per-entity.
    kind: entity.params.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
    // ADR-421 SLICE C — carry the Family/Type link through first-save (omitted
    // when undefined so Firestore never receives an `undefined`).
    ...(entity.typeId !== undefined && { typeId: entity.typeId }),
    ...(entity.typeOverrides !== undefined && { typeOverrides: entity.typeOverrides }),
  };
}
