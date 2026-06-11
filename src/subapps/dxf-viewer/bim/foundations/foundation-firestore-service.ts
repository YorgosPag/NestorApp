'use client';

/**
 * ADR-436 Slice 1-persist — Foundation Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_foundations/{foundationId}` (companyId-scoped via
 * field). Mirror του `ColumnFirestoreService` — structural, point/line-based,
 * ΧΩΡΙΣ connectors/BOQ/buildingId. Re-uses `firestoreQueryService.subscribe`
 * SSoT (ADR-355) + ADR-420 floor-scope helper.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_FOUNDATIONS', ...)` με
 * `(projectId, floorId||floorplanId)` constraints. Tenant `companyId`
 * εφαρμόζεται αυτόματα (CHECK 3.10).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateFoundationId`) για το
 * enterprise-id contract (SOS N.6). Auto-id writes απαγορεύονται από τον SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
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
import { generateFoundationId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  FoundationEntity,
  FoundationGeometry,
  FoundationKind,
  FoundationParams,
} from '../types/foundation-types';
import type { BimValidation } from '../types/bim-base';
import type { GuideBinding } from '../hosting/guide-binding-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για a persisted foundation. Mirror του
 * `ColumnDoc`: params + validation persisted· geometry optional (re-derivable
 * από `computeFoundationGeometry(params)`).
 */
export interface FoundationDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: FoundationKind;
  readonly params: FoundationParams;
  readonly validation: BimValidation;
  readonly geometry?: FoundationGeometry;
  readonly floorId?: string;
  readonly layerId?: string;
  /**
   * ADR-441 Slice 3 — associative grid hosting. Slot-based bindings σε άξονες
   * κανάβου· χωρίς αυτά, μετά από reload το follow-on-move θα ήταν νεκρό (η
   * entity δεν θα ήξερε σε ποιους άξονες είναι «κρεμασμένη»). Plain `{guideId,
   * slot}` objects → Firestore-safe.
   */
  readonly guideBindings?: readonly GuideBinding[];
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface FoundationFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface FoundationSaveInput {
  readonly id?: string;
  readonly kind: FoundationKind;
  readonly params: FoundationParams;
  readonly validation: BimValidation;
  readonly geometry?: FoundationGeometry;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-441 Slice 3 — grid hosting bindings (born-hosted strips from grid). */
  readonly guideBindings?: readonly GuideBinding[];
}

export interface FoundationUpdateInput {
  readonly params?: FoundationParams;
  readonly validation?: BimValidation;
  readonly geometry?: FoundationGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class FoundationFirestoreService {
  constructor(private readonly config: FoundationFirestoreServiceConfig) {}

  private docRef(foundationId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_FOUNDATIONS, foundationId);
  }

  /**
   * Real-time subscription scoped σε `(projectId, floorId||floorplanId)`.
   * Tenant `companyId` auto-applied από `firestoreQueryService`. ADR-361
   * equality guard upstream → no idle re-render storms.
   */
  subscribeFoundations(
    onChange: (foundations: readonly FoundationDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<FoundationDoc>(
      'FLOORPLAN_FOUNDATIONS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new foundation ή overwrite υπάρχουσα (id-preserving). Audit
   * fields: `createdBy/createdAt` set μόνο σε first write,
   * `updatedBy/updatedAt` refresh every call.
   *
   * Enterprise-id (SOS N.6): `generateFoundationId()` όταν δεν δοθεί `id`.
   */
  async saveFoundation(input: FoundationSaveInput): Promise<FoundationDoc> {
    const id = input.id ?? generateFoundationId();
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
    if (input.geometry !== undefined) base.geometry = input.geometry;
    // ADR-420 — floorId is owned by config scope (bimScopeWriteFields above), not input.
    if (input.layerId !== undefined) base.layerId = input.layerId;
    // ADR-441 Slice 3 — persist hosting bindings (Firestore rejects undefined).
    if (input.guideBindings !== undefined) base.guideBindings = input.guideBindings;

    await setDoc(ref, base);
    return base as unknown as FoundationDoc;
  }

  async updateFoundation(foundationId: string, patch: FoundationUpdateInput): Promise<void> {
    const ref = this.docRef(foundationId);
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

  async deleteFoundation(foundationId: string): Promise<void> {
    await deleteDoc(this.docRef(foundationId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createFoundationFirestoreService(
  config: FoundationFirestoreServiceConfig,
): FoundationFirestoreService {
  return new FoundationFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `FoundationEntity` σε `FoundationSaveInput`. Re-derivable
 * fields (`geometry`) intentionally omitted — geometry recomputed client-side
 * από params on hydrate.
 */
export function entityToSaveInput(entity: FoundationEntity): FoundationSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
    // ADR-441 Slice 3 — carry grid hosting bindings into the persisted doc.
    guideBindings: entity.guideBindings,
  };
}
