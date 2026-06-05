'use client';

/**
 * ADR-408 Εύρος Β #2 — Heating boiler Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_boilers/{boilerId}` (companyId-scoped via
 * field). Mirrors `MepRadiatorFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepBoilerId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
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
import { generateMepBoilerId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  MepBoilerEntity,
  MepBoilerGeometry,
  MepBoilerKind,
  MepBoilerParams,
} from '../types/mep-boiler-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted heating boiler. Mirrors
 * `MepRadiatorDoc`: params + validation persisted; geometry optional (re-derivable
 * from `computeMepBoilerGeometry(params)`).
 */
export interface MepBoilerDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepBoilerKind;
  readonly params: MepBoilerParams;
  readonly validation: BimValidation;
  readonly geometry?: MepBoilerGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepBoilerFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface MepBoilerSaveInput {
  readonly id?: string;
  readonly kind: MepBoilerKind;
  readonly params: MepBoilerParams;
  readonly validation: BimValidation;
  readonly geometry?: MepBoilerGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepBoilerUpdateInput {
  readonly params?: MepBoilerParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepBoilerGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepBoilerFirestoreService {
  constructor(private readonly config: MepBoilerFirestoreServiceConfig) {}

  private docRef(boilerId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_BOILERS, boilerId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant `companyId`
   * auto-applied by `firestoreQueryService`.
   */
  subscribeBoilers(
    onChange: (boilers: readonly MepBoilerDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepBoilerDoc>(
      'FLOORPLAN_MEP_BOILERS',
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
   * Persist a new boiler or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepBoilerId()` when no `id` supplied.
   */
  async saveBoiler(input: MepBoilerSaveInput): Promise<MepBoilerDoc> {
    const id = input.id ?? generateMepBoilerId();
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
    return base as unknown as MepBoilerDoc;
  }

  async updateBoiler(boilerId: string, patch: MepBoilerUpdateInput): Promise<void> {
    const ref = this.docRef(boilerId);
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

  async deleteBoiler(boilerId: string): Promise<void> {
    await deleteDoc(this.docRef(boilerId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepBoilerFirestoreService(
  config: MepBoilerFirestoreServiceConfig,
): MepBoilerFirestoreService {
  return new MepBoilerFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepBoilerEntity` to `MepBoilerSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: MepBoilerEntity): MepBoilerSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
