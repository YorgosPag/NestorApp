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
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { createFoundation } from '@/services/factories/foundation.factory';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { validateFoundationParams } from '../validators/foundation-validator';
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
  /**
   * ADR-441 Slice 6b — re-host legacy ορφανών: το update μπορεί να αλλάξει ΜΟΝΟ τα
   * hosting bindings (χωρίς νέο doc). Persist-άρει σε υπάρχον doc μέσω `updateDoc`.
   */
  readonly guideBindings?: readonly GuideBinding[];
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
      // ADR-463 — sanitize nested `undefined` (π.χ. pad χωρίς topMesh / strip χωρίς
      // stirrups): Firestore πετά «Unsupported field value: undefined» → silent catch →
      // ο οπλισμός ΔΕΝ persist-άρεται σε reload. SSoT `stripUndefinedDeep` (mirror κολώνας).
      params: stripUndefinedDeep(input.params),
      validation: stripUndefinedDeep(input.validation),
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    // Firestore rejects `undefined` — include optional fields μόνο όταν set.
    if (input.geometry !== undefined) base.geometry = stripUndefinedDeep(input.geometry);
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
    if (patch.params !== undefined) payload.params = stripUndefinedDeep(patch.params);
    if (patch.validation !== undefined) payload.validation = stripUndefinedDeep(patch.validation);
    if (patch.geometry !== undefined) payload.geometry = stripUndefinedDeep(patch.geometry);
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    // ADR-441 Slice 6b — persist hosting bindings on re-host (Firestore rejects undefined).
    if (patch.guideBindings !== undefined) payload.guideBindings = patch.guideBindings;

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
 * Build a scene-side `FoundationEntity` από persisted `FoundationDoc` (SSoT
 * hydrate). Geometry + validation recomputed via pure functions· IFC mixin
 * auto-filled από το `createFoundation` factory (predefinedType ντετερμινιστικά
 * από kind). Reused by `useFoundationPersistence` (active-floor subscription) +
 * `useFoundationLevelSync` (cross-level foundation-floor model sourcing, ADR-459 Φ7).
 *
 * Carries the durable floor scope (`floorId`/`floorplanId`) onto the entity so the
 * cross-level association guards (`stripForeignFloorBim` / `replaceFootingsFromModel`)
 * key correctly on the building-storey id (ADR-420), independent of any provenance drift.
 */
export function foundationDocToEntity(doc: FoundationDoc): FoundationEntity {
  const validation = doc.validation ?? validateFoundationParams(doc.params).bimValidation;
  const entity = createFoundation({
    id: doc.id,
    params: doc.params,
    geometry: doc.geometry ?? computeFoundationGeometry(doc.params),
    layerId: doc.layerId ?? '0',
    visible: true,
    validation,
  });
  // ADR-441 Slice 3 — restore grid hosting bindings (createFoundation factory δεν
  // δέχεται bindings → spread μετά) so follow-on-move survives reload.
  const hosted = doc.guideBindings ? { ...entity, guideBindings: doc.guideBindings } : entity;
  return {
    ...hosted,
    ...(doc.floorId ? { floorId: doc.floorId } : {}),
    floorplanId: doc.floorplanId,
  };
}

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
