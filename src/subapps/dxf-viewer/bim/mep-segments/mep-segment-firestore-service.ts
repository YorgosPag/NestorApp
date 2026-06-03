'use client';

/**
 * ADR-408 Φ8 — MEP segment Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_segments/{segmentId}` (companyId-scoped via
 * field). Mirrors `ElectricalPanelFirestoreService` (ADR-408 Φ3).
 * Re-uses `firestoreQueryService` SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepSegmentId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
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
import { generateMepSegmentId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  MepSegmentEntity,
  MepSegmentGeometry,
  MepSegmentKind,
  MepSegmentParams,
} from '../types/mep-segment-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted MEP segment. Mirrors
 * `ElectricalPanelDoc`: params + validation persisted; geometry optional
 * (re-derivable from `computeMepSegmentGeometry(params)`).
 */
export interface MepSegmentDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepSegmentKind;
  readonly params: MepSegmentParams;
  readonly validation: BimValidation;
  readonly geometry?: MepSegmentGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepSegmentFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface MepSegmentSaveInput {
  readonly id?: string;
  readonly kind: MepSegmentKind;
  readonly params: MepSegmentParams;
  readonly validation: BimValidation;
  readonly geometry?: MepSegmentGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepSegmentUpdateInput {
  readonly params?: MepSegmentParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepSegmentGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepSegmentFirestoreService {
  constructor(private readonly config: MepSegmentFirestoreServiceConfig) {}

  private docRef(segmentId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_SEGMENTS, segmentId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribeSegments(
    onChange: (segments: readonly MepSegmentDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepSegmentDoc>(
      'FLOORPLAN_MEP_SEGMENTS',
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
   * Persist a new segment or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepSegmentId()` when no `id` supplied.
   */
  async saveSegment(input: MepSegmentSaveInput): Promise<MepSegmentDoc> {
    const id = input.id ?? generateMepSegmentId();
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
    return base as unknown as MepSegmentDoc;
  }

  async updateSegment(segmentId: string, patch: MepSegmentUpdateInput): Promise<void> {
    const ref = this.docRef(segmentId);
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

  async deleteSegment(segmentId: string): Promise<void> {
    await deleteDoc(this.docRef(segmentId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepSegmentFirestoreService(
  config: MepSegmentFirestoreServiceConfig,
): MepSegmentFirestoreService {
  return new MepSegmentFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepSegmentEntity` to `MepSegmentSaveInput`.
 * Re-derivable `geometry` intentionally omitted — recomputed client-side from
 * params on hydrate.
 */
export function entityToSaveInput(entity: MepSegmentEntity): MepSegmentSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
