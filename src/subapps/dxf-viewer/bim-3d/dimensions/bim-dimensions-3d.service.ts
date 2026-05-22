'use client';

/**
 * ADR-366 Phase 9 / C.3 — bim-dimensions-3d.service.
 *
 * Client-side Firestore CRUD wrapper for `bim_dimensions_3d`. Mirror pattern of
 * `Bim3DPreferencesService` (ADR-366 Phase 4.3) — direct setDoc with enterprise
 * IDs (N.6 compliant).
 *
 * Audit trail is written by CDC trigger on document change (ADR-195 Phase 1)
 * once Cloud Function `auditBim3DDimensionWrite` deploys — service stays lean.
 *
 * Entity-follow: `subscribeToEntityTransform()` re-projects endpoints via the
 * host entity's current transform; on entity delete the caller switches to
 * orphan mode via `markOrphaned()`.
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBim3DDimensionId } from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { nowISO } from '@/lib/date-local';
import type {
  BimDimension3D,
  Dim3DAnchor,
  Dim3DLeaderStyle,
  Dim3DMode,
  Dim3DPlacement,
  Dim3DTextPlane,
  Dim3DUnit,
  Vec2,
} from './dim3d-types';
import { computeDim3DValue } from './dim3d-value-computer';

export interface CreateDim3DInput {
  readonly projectId: string;
  readonly companyId: string;
  readonly createdBy: string;
  readonly mode: Dim3DMode;
  readonly placement: Dim3DPlacement;
  readonly anchor: Dim3DAnchor;
  readonly textOffset: Vec2;
  readonly textPlane: Dim3DTextPlane;
  readonly unit: Dim3DUnit;
  readonly precision: number;
  readonly leaderStyle: Dim3DLeaderStyle;
}

export interface UpdateDim3DInput {
  readonly placement?: Dim3DPlacement;
  readonly anchor?: Dim3DAnchor;
  readonly textOffset?: Vec2;
  readonly textPlane?: Dim3DTextPlane;
  readonly unit?: Dim3DUnit;
  readonly precision?: number;
  readonly leaderStyle?: Dim3DLeaderStyle;
}

function buildCreatePayload(input: CreateDim3DInput): BimDimension3D {
  const id = generateBim3DDimensionId();
  const value = computeDim3DValue(input.mode, input.placement, input.anchor);
  const now = nowISO();
  return {
    id,
    projectId: input.projectId,
    companyId: input.companyId,
    mode: input.mode,
    placement: input.placement,
    anchor: input.anchor,
    textOffset: input.textOffset,
    textPlane: input.textPlane,
    value,
    unit: input.unit,
    precision: input.precision,
    leaderStyle: input.leaderStyle,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

export const BimDimensions3DService = {
  async create(input: CreateDim3DInput): Promise<BimDimension3D> {
    const payload = buildCreatePayload(input);
    const ref = doc(db, COLLECTIONS.BIM_DIMENSIONS_3D, payload.id);
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return payload;
  },

  async update(dimensionId: string, current: BimDimension3D, patch: UpdateDim3DInput): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_DIMENSIONS_3D, dimensionId);
    const nextMode = current.mode;
    const nextPlacement = patch.placement ?? current.placement;
    const nextAnchor = patch.anchor ?? current.anchor;
    const recomputedValue =
      patch.placement || patch.anchor
        ? computeDim3DValue(nextMode, nextPlacement, nextAnchor)
        : current.value;
    await updateDoc(ref, {
      ...patch,
      value: recomputedValue,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(dimensionId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_DIMENSIONS_3D, dimensionId);
    await deleteDoc(ref);
  },

  async markOrphaned(dimensionId: string, hostEntityIds: readonly string[]): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_DIMENSIONS_3D, dimensionId);
    await updateDoc(ref, {
      orphanedFromEntityIds: hostEntityIds,
      'anchor.hostEntityIds': [],
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Live subscription to all dimensions in a project. Returns an Unsubscribe
   * function. Consumer typically pipes the array into BimDimensions3DStore.
   * SSoT subscribe per `firestore-realtime` module (companyId tenant auto-applied).
   */
  subscribeByProject(
    projectId: string,
    onChange: (dimensions: readonly BimDimension3D[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<BimDimension3D>(
      'BIM_DIMENSIONS_3D',
      (result) => onChange(result.documents),
      (err) => onError?.(err),
      { constraints: [where('projectId', '==', projectId)] },
    );
  },
} as const;
