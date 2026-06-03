'use client';

/**
 * ADR-363 Phase 1B — Wall Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_walls/{wallId}` (companyId-scoped via field).
 * Mirrors `StairFirestoreService` (ADR-358 §G6 Phase 8) — top-level collection
 * with `companyId` field-based tenant isolation. Enables reuse of
 * `firestoreQueryService.subscribe` SSoT (ADR-355) and its built-in equality
 * guard (ADR-361, prevents idle re-render storms).
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_WALLS', ...)` with
 * `(projectId, floorplanId)` constraints. Tenant `companyId` constraint is
 * applied automatically by the service via `buildTenantConstraints`.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateWallId`) to preserve
 * enterprise-id contract (SOS N.6) and the canonical `WallDoc` audit fields
 * (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`). Auto-id writes (`add`
 * variant) are forbidden by the pre-commit SSoT ratchet.
 *
 * Soft-lock (display-only, mirrors stair G24): `acquireLock` stamps
 * `editingBy = { userId: self, since: serverTimestamp() }`; `releaseLock`
 * clears via `deleteField()` sentinel. NEVER blocks other users.
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
  where,
  type FieldValue,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateWallId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type {
  WallEntity,
  WallGeometry,
  WallKind,
  WallParams,
} from '../types/wall-types';
import type { WallTypeParams } from '../types/bim-family-type';
import type { BimValidation, SoftLock } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted wall. Mirrors `StairDoc`:
 * params + validation are persisted; geometry is optional (re-derivable from
 * params via `computeWallGeometry()`).
 */
export interface WallDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: WallKind;
  readonly params: WallParams;
  readonly validation: BimValidation;
  readonly geometry?: WallGeometry;
  readonly editingBy?: SoftLock;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-412 — FK → BimFamilyType.id. Absent on untyped/legacy walls. */
  readonly typeId?: string;
  /** ADR-412 — Per-instance overrides of type-level params. Absent = use type as-is. */
  readonly typeOverrides?: Partial<WallTypeParams>;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface WallFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface WallSaveInput {
  readonly id?: string;
  readonly kind: WallKind;
  readonly params: WallParams;
  readonly validation: BimValidation;
  readonly geometry?: WallGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  /** ADR-412 — FK → BimFamilyType.id. Omit for untyped walls. */
  readonly typeId?: string;
  /** ADR-412 — Per-instance overrides of type-level params. */
  readonly typeOverrides?: Partial<WallTypeParams>;
}

export interface WallUpdateInput {
  readonly params?: WallParams;
  readonly validation?: BimValidation;
  readonly geometry?: WallGeometry;
  readonly layerId?: string;
  /**
   * ADR-412 — FK → BimFamilyType.id.
   *   - omit (`undefined`) → leave the stored field unchanged,
   *   - `string`           → set the linkage,
   *   - `null`             → clear it (detach to ad-hoc, `deleteField()`).
   */
  readonly typeId?: string | null;
  /** ADR-412 — Per-instance overrides; `null` clears the field (`deleteField()`). */
  readonly typeOverrides?: Partial<WallTypeParams> | null;
}

// ============================================================================
// SERVICE
// ============================================================================

export class WallFirestoreService {
  constructor(private readonly config: WallFirestoreServiceConfig) {}

  private docRef(wallId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_WALLS, wallId);
  }

  /**
   * Real-time subscription scoped to current `(projectId, floorplanId)`.
   * Tenant `companyId` constraint is auto-applied by `firestoreQueryService`.
   * ADR-361 equality guard runs upstream — consumers only see real content
   * changes, no spurious 60fps re-renders on snapshot cache hydration.
   */
  subscribeWalls(
    onChange: (walls: readonly WallDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<WallDoc>(
      'FLOORPLAN_WALLS',
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
   * Persist a new wall or overwrite an existing one (id-preserving).
   * Audit fields: `createdBy/createdAt` set only on first write,
   * `updatedBy/updatedAt` refreshed every call. `setDoc` with `merge: false`
   * is intentional — payload carries the full canonical document shape.
   *
   * Enterprise-id (SOS N.6): `generateWallId()` when `id` not provided.
   * Auto-id writes are forbidden.
   */
  async saveWall(input: WallSaveInput): Promise<WallDoc> {
    const id = input.id ?? generateWallId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      floorplanId: this.config.floorplanId,
      kind: input.kind,
      // Firestore rejects nested `undefined` (e.g. `params.polylineVertices` on a
      // straight wall) — deep-strip the pure-data sub-objects. serverTimestamp()
      // sentinels stay at the top level, untouched (SSoT: firestore-sanitize).
      params: stripUndefinedDeep(input.params),
      validation: stripUndefinedDeep(input.validation),
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    // Firestore rejects `undefined` — only include optional fields when set.
    if (input.geometry !== undefined) base.geometry = stripUndefinedDeep(input.geometry);
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    if (input.floorId !== undefined) base.floorId = input.floorId;
    if (input.layerId !== undefined) base.layerId = input.layerId;
    // ADR-412 — Family-type linkage (optional; omit when absent).
    if (input.typeId !== undefined) base.typeId = input.typeId;
    if (input.typeOverrides !== undefined) base.typeOverrides = stripUndefinedDeep(input.typeOverrides);

    await setDoc(ref, base);
    return base as unknown as WallDoc;
  }

  async updateWall(wallId: string, patch: WallUpdateInput): Promise<void> {
    const ref = this.docRef(wallId);
    const payload: Record<string, unknown> = {
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    // Deep-strip nested `undefined` from the pure-data sub-objects (Firestore
    // rejects undefined, e.g. `params.polylineVertices` on a straight wall). The
    // serverTimestamp() sentinels above are left untouched (SSoT: firestore-sanitize).
    if (patch.params !== undefined) payload.params = stripUndefinedDeep(patch.params);
    if (patch.validation !== undefined) payload.validation = stripUndefinedDeep(patch.validation);
    if (patch.geometry !== undefined) payload.geometry = stripUndefinedDeep(patch.geometry);
    if (patch.layerId !== undefined) payload.layerId = patch.layerId;
    // ADR-412 — Family-type linkage. `null` clears the field (detach to ad-hoc);
    // a string sets it; `undefined` leaves the stored value untouched.
    if (patch.typeId !== undefined) {
      payload.typeId = patch.typeId === null ? deleteField() : patch.typeId;
    }
    if (patch.typeOverrides !== undefined) {
      payload.typeOverrides =
        patch.typeOverrides === null
          ? deleteField()
          : stripUndefinedDeep(patch.typeOverrides);
    }

    await updateDoc(ref, payload);
  }

  async deleteWall(wallId: string): Promise<void> {
    await deleteDoc(this.docRef(wallId));
  }

  /**
   * Soft-lock acquire — stamps `editingBy = { userId: self, since: <server> }`.
   * NEVER blocks other users (display hint, not exclusivity gate). Mirrors
   * stair G24 contract.
   */
  async acquireLock(wallId: string): Promise<void> {
    const ref = this.docRef(wallId);
    await updateDoc(ref, {
      editingBy: {
        userId: this.config.userId,
        since: serverTimestamp(),
      },
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });
  }

  /** Soft-lock release — clears `editingBy` via `deleteField()` sentinel. */
  async releaseLock(wallId: string): Promise<void> {
    const ref = this.docRef(wallId);
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

export function createWallFirestoreService(
  config: WallFirestoreServiceConfig,
): WallFirestoreService {
  return new WallFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `WallEntity` to a `WallSaveInput`. Re-derivable fields
 * (`geometry`) are intentionally omitted — ADR §G6 stair pattern. Geometry
 * is recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: WallEntity): WallSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
    // ADR-412 — pass through when present; omit when absent (no undefined in output).
    ...(entity.typeId !== undefined && { typeId: entity.typeId }),
    ...(entity.typeOverrides !== undefined && { typeOverrides: entity.typeOverrides }),
  };
}
