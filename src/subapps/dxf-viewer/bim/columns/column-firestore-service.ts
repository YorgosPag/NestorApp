'use client';

/**
 * ADR-363 Phase 4 — Column Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_columns/{columnId}` (companyId-scoped via field).
 * Mirrors `WallFirestoreService` / `SlabFirestoreService`. Re-uses
 * `firestoreQueryService.subscribe` SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_COLUMNS', ...)` με
 * `(projectId, floorplanId)` constraints. Tenant `companyId` εφαρμόζεται
 * αυτόματα.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateColumnId`) για
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
import { generateColumnId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  ColumnEntity,
  ColumnGeometry,
  ColumnKind,
  ColumnParams,
} from '../types/column-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape για a persisted column. Mirrors
 * `SlabDoc`: params + validation persisted; geometry optional (re-derivable
 * από `computeColumnGeometry(params)`).
 */
export interface ColumnDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: ColumnKind;
  readonly params: ColumnParams;
  readonly validation: BimValidation;
  readonly geometry?: ColumnGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface ColumnFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface ColumnSaveInput {
  readonly id?: string;
  readonly kind: ColumnKind;
  readonly params: ColumnParams;
  readonly validation: BimValidation;
  readonly geometry?: ColumnGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface ColumnUpdateInput {
  readonly params?: ColumnParams;
  readonly validation?: BimValidation;
  readonly geometry?: ColumnGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ColumnFirestoreService {
  constructor(private readonly config: ColumnFirestoreServiceConfig) {}

  private docRef(columnId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_COLUMNS, columnId);
  }

  /**
   * Real-time subscription scoped σε `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied από `firestoreQueryService`. ADR-361 equality
   * guard upstream → no idle re-render storms.
   */
  subscribeColumns(
    onChange: (columns: readonly ColumnDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<ColumnDoc>(
      'FLOORPLAN_COLUMNS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new column ή overwrite υπάρχουσα (id-preserving). Audit
   * fields: `createdBy/createdAt` set μόνο σε first write,
   * `updatedBy/updatedAt` refresh every call.
   *
   * Enterprise-id (SOS N.6): `generateColumnId()` όταν δεν δοθεί `id`.
   */
  async saveColumn(input: ColumnSaveInput): Promise<ColumnDoc> {
    const id = input.id ?? generateColumnId();
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
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    // ADR-420 — floorId is owned by config scope (bimScopeWriteFields above), not input.
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as ColumnDoc;
  }

  async updateColumn(columnId: string, patch: ColumnUpdateInput): Promise<void> {
    const ref = this.docRef(columnId);
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

  async deleteColumn(columnId: string): Promise<void> {
    await deleteDoc(this.docRef(columnId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createColumnFirestoreService(
  config: ColumnFirestoreServiceConfig,
): ColumnFirestoreService {
  return new ColumnFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `ColumnEntity` σε `ColumnSaveInput`. Re-derivable
 * fields (`geometry`) intentionally omitted — geometry recomputed
 * client-side από params on hydrate.
 */
export function entityToSaveInput(entity: ColumnEntity): ColumnSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
