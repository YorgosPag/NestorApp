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
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBeamId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  BeamEntity,
  BeamGeometry,
  BeamKind,
  BeamParams,
} from '../types/beam-types';
import type { BimValidation } from '../types/bim-base';

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
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface BeamFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
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
}

export interface BeamUpdateInput {
  readonly params?: BeamParams;
  readonly validation?: BimValidation;
  readonly geometry?: BeamGeometry;
  readonly layerId?: string;
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
        constraints: [
          where('projectId', '==', this.config.projectId),
          where('floorplanId', '==', this.config.floorplanId),
        ],
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
      floorplanId: this.config.floorplanId,
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
    if (input.floorId !== undefined) base.floorId = input.floorId;
    if (input.layerId !== undefined) base.layerId = input.layerId;

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
  };
}
