'use client';

/**
 * ADR-363 Phase 5 — Beam Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_beams/{beamId}` (companyId-scoped via field).
 * Mirrors `ColumnFirestoreService` — same shape, same constraints.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_BEAMS', ...)` με
 * `(projectId, floorplanId)` constraints. Tenant `companyId` εφαρμόζεται
 * αυτόματα.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateBeamId`) για
 * enterprise-id contract (SOS N.6). Auto-id writes απαγορεύονται από SSoT
 * ratchet.
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
import { generateBeamId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  BeamEntity,
  BeamGeometry,
  BeamKind,
  BeamParams,
} from '../types/beam-types';
import type { BimValidation } from '../types/bim-base';
import type { GuideBinding } from '../hosting/guide-binding-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για a persisted beam. Mirrors
 * `ColumnDoc`: params + validation persisted; geometry optional
 * (re-derivable από `computeBeamGeometry(params)`).
 */
export interface BeamDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: BeamKind;
  readonly params: BeamParams;
  readonly validation: BimValidation;
  readonly geometry?: BeamGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-441 Slice GEN-BEAM — associative grid hosting bindings (born-bound δοκοί). */
  readonly guideBindings?: readonly GuideBinding[];
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface BeamFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface BeamSaveInput {
  readonly id?: string;
  readonly kind: BeamKind;
  readonly params: BeamParams;
  readonly validation: BimValidation;
  readonly geometry?: BeamGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-441 Slice GEN-BEAM — grid hosting bindings (host-on-create). */
  readonly guideBindings?: readonly GuideBinding[];
}

export interface BeamUpdateInput {
  readonly params?: BeamParams;
  readonly validation?: BimValidation;
  readonly geometry?: BeamGeometry;
  readonly layerId?: string;
  /** ADR-441 Slice GEN-BEAM — grid hosting bindings (round-trip on update). */
  readonly guideBindings?: readonly GuideBinding[];
}

// ============================================================================
// SERVICE
// ============================================================================

export class BeamFirestoreService {
  constructor(private readonly config: BeamFirestoreServiceConfig) {}

  private docRef(beamId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_BEAMS, beamId);
  }

  /**
   * Real-time subscription scoped σε `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied από `firestoreQueryService`. ADR-361 equality
   * guard upstream → no idle re-render storms.
   */
  subscribeBeams(
    onChange: (beams: readonly BeamDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<BeamDoc>(
      'FLOORPLAN_BEAMS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new beam ή overwrite υπάρχον (id-preserving). Audit fields:
   * `createdBy/createdAt` set μόνο σε first write, `updatedBy/updatedAt`
   * refresh every call.
   *
   * Enterprise-id (SOS N.6): `generateBeamId()` όταν δεν δοθεί `id`.
   */
  async saveBeam(input: BeamSaveInput): Promise<BeamDoc> {
    const id = input.id ?? generateBeamId();
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
    // ADR-441 Slice GEN-BEAM — persist grid hosting bindings (Firestore rejects undefined).
    if (input.guideBindings !== undefined) base.guideBindings = input.guideBindings;

    await setDoc(ref, base);
    return base as unknown as BeamDoc;
  }

  async updateBeam(beamId: string, patch: BeamUpdateInput): Promise<void> {
    const ref = this.docRef(beamId);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    // ADR-441 Slice GEN-BEAM — round-trip grid hosting bindings on update.
    if (patch.guideBindings !== undefined) payload.guideBindings = patch.guideBindings;

    await updateDoc(ref, payload);
  }

  async deleteBeam(beamId: string): Promise<void> {
    await deleteDoc(this.docRef(beamId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createBeamFirestoreService(
  config: BeamFirestoreServiceConfig,
): BeamFirestoreService {
  return new BeamFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `BeamEntity` σε `BeamSaveInput`. Re-derivable
 * fields (`geometry`) intentionally omitted — geometry recomputed
 * client-side από params on hydrate.
 */
export function entityToSaveInput(entity: BeamEntity): BeamSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
    // ADR-441 Slice GEN-BEAM — carry grid hosting bindings into the persisted doc.
    ...(entity.guideBindings !== undefined && { guideBindings: entity.guideBindings }),
  };
}
