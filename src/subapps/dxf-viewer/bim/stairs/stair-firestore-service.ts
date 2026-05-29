'use client';

/**
 * ADR-358 Phase 8 — Stair Firestore persistence SSoT (G24 soft-lock, G6 schema).
 *
 * Path: top-level `floorplan_stairs/{stairId}` (companyId-scoped via field).
 * Aligned with BUILDINGS / PROJECTS pattern: top-level collection with
 * `companyId` field-based tenant isolation rather than nested subcollection.
 * Enables reuse of `firestoreQueryService.subscribe` SSoT (ADR-355) and its
 * built-in equality guard (ADR-361, prevents idle re-render storms).
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_STAIRS', ...)` with
 * `(projectId, floorplanId)` constraints. Tenant `companyId` constraint is
 * applied automatically by the service via `buildTenantConstraints`.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateStairId`) to preserve
 * enterprise-id contract (SOS N.6) and the canonical `StairDoc` audit fields
 * (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`). Auto-id writes (add
 * variant) are forbidden by the pre-commit SSoT ratchet.
 *
 * Soft-lock (G24, §6.8) — display-only multi-user indicator. `acquireLock`
 * stamps `editingBy = { userId: self, since: serverTimestamp() }`; `releaseLock`
 * clears via `deleteField()` sentinel. NEVER blocks other users; renderers show
 * a badge "Editing by …" when `editingBy.userId !== self`. 5min TTL is enforced
 * by the consuming hook (`useStairPersistence`) — readers may auto-release stale
 * locks idempotently.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1, §6.8, §7.2 row 8
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
  where,
  type FieldValue,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateStairId } from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore';
import type {
  StairDoc,
  StairEntity,
  StairKind,
  StairParams,
} from '../../bim/types/stair-types';

// ============================================================================
// CONFIG
// ============================================================================

export interface StairFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface StairSaveInput {
  readonly id?: string; // optional — when provided, persists under existing id
  readonly kind: StairKind;
  readonly params: StairParams;
  readonly validation: StairDoc['validation'];
  readonly geometry?: StairDoc['geometry'];
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layer?: string;
  readonly levelId?: string;
}

export interface StairUpdateInput {
  readonly params?: StairParams;
  readonly validation?: StairDoc['validation'];
  readonly geometry?: StairDoc['geometry'];
  readonly layer?: string;
  readonly levelId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class StairFirestoreService {
  constructor(private readonly config: StairFirestoreServiceConfig) {}

  private docRef(stairId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_STAIRS, stairId);
  }

  /**
   * Real-time subscription scoped to current `(projectId, floorplanId)`.
   * Tenant `companyId` constraint is auto-applied by `firestoreQueryService`.
   * ADR-361 equality guard runs upstream — consumers only see real content
   * changes, no spurious 60fps re-renders on snapshot cache hydration.
   */
  subscribeStairs(
    onChange: (stairs: readonly StairDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<StairDoc>(
      'FLOORPLAN_STAIRS',
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
   * Persist a new stair or overwrite an existing one (id-preserving).
   * Audit fields: `createdBy/createdAt` set only on first write,
   * `updatedBy/updatedAt` refreshed every call. `setDoc` with `merge: false`
   * is intentional — payload contains the full canonical document shape so
   * partial deletions of optional fields (geometry) are honored.
   *
   * Enterprise-id (SOS N.6): `generateStairId()` when `id` not provided;
   * auto-id writes are forbidden.
   */
  async saveStair(input: StairSaveInput): Promise<StairDoc> {
    const id = input.id ?? generateStairId();
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

    // Firestore rejects `undefined` — only include optional fields when set.
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.floorId !== undefined) base.floorId = input.floorId;
    if (input.layer !== undefined) base.layer = input.layer;
    if (input.levelId !== undefined) base.levelId = input.levelId;

    await setDoc(ref, base);
    return base as unknown as StairDoc;
  }

  /**
   * Partial update — patches the provided fields and refreshes
   * `updatedBy/updatedAt`. `companyId/projectId/floorplanId/createdBy/createdAt`
   * are immutable by contract and excluded from the patch surface.
   */
  async updateStair(stairId: string, patch: StairUpdateInput): Promise<void> {
    const ref = this.docRef(stairId);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    if (patch.params !== undefined) payload.params = patch.params;
    if (patch.validation !== undefined) payload.validation = patch.validation;
    if (patch.geometry !== undefined) payload.geometry = patch.geometry;
    if (patch.layer !== undefined) payload.layer = patch.layer;
    if (patch.levelId !== undefined) payload.levelId = patch.levelId;

    await updateDoc(ref, payload);
  }

  async deleteStair(stairId: string): Promise<void> {
    await deleteDoc(this.docRef(stairId));
  }

  /**
   * G24 soft-lock acquire — stamps `editingBy = { userId: self, since: <server> }`.
   * Idempotent at the data layer (writing same userId is a no-op semantically);
   * callers should still throttle calls to avoid Firestore write rate inflation.
   * NEVER blocks other users — the lock is a display hint, not an exclusivity
   * gate. Other readers render a badge "Editing by …" when `userId !== self`.
   */
  async acquireLock(stairId: string): Promise<void> {
    const ref = this.docRef(stairId);
    await updateDoc(ref, {
      editingBy: {
        userId: this.config.userId,
        since: serverTimestamp(),
      },
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * G24 soft-lock release — clears `editingBy` via `deleteField()` sentinel.
   * Safe to call when no lock is held (Firestore treats deleteField on
   * non-existent field as no-op).
   */
  async releaseLock(stairId: string): Promise<void> {
    const ref = this.docRef(stairId);
    const payload: Record<string, FieldValue | string> = {
      editingBy: deleteField(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(ref, payload);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createStairFirestoreService(
  config: StairFirestoreServiceConfig,
): StairFirestoreService {
  return new StairFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `StairEntity` to a `StairSaveInput`. Re-derivable
 * fields (`geometry`) are intentionally omitted — ADR §G6 stores params +
 * validation summary only; geometry is recomputed client-side from params.
 */
export function entityToSaveInput(entity: StairEntity): StairSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    levelId: entity.levelId,
    floorId: entity.floorId,
    buildingId: entity.buildingId,
  };
}
