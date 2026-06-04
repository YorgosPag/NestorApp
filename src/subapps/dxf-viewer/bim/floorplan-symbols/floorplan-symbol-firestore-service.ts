'use client';

/**
 * ADR-415 Φ1 — Floorplan symbol Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_symbols/{symbolId}` (companyId-scoped via field).
 * Mirrors `FurnitureFirestoreService`. Re-uses `firestoreQueryService` SSoT
 * (ADR-355).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateFloorplanSymbolId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
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
import { generateFloorplanSymbolId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type {
  FloorplanSymbolEntity,
  FloorplanSymbolGeometry,
  FloorplanSymbolKind,
  FloorplanSymbolParams,
} from '../types/floorplan-symbol-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted floorplan symbol. Mirrors
 * `FurnitureDoc`: params + validation persisted; geometry optional (re-derivable
 * from `computeFloorplanSymbolGeometry(params)`). `category` is duplicated at the
 * top level (mirrors `kind`) so the security rules can require it.
 */
export interface FloorplanSymbolDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly category: FloorplanSymbolParams['category'];
  readonly kind: FloorplanSymbolKind;
  readonly params: FloorplanSymbolParams;
  readonly validation: BimValidation;
  readonly geometry?: FloorplanSymbolGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface FloorplanSymbolFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface FloorplanSymbolSaveInput {
  readonly id?: string;
  readonly category: FloorplanSymbolParams['category'];
  readonly kind: FloorplanSymbolKind;
  readonly params: FloorplanSymbolParams;
  readonly validation: BimValidation;
  readonly geometry?: FloorplanSymbolGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface FloorplanSymbolUpdateInput {
  readonly params?: FloorplanSymbolParams;
  readonly validation?: BimValidation;
  readonly geometry?: FloorplanSymbolGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class FloorplanSymbolFirestoreService {
  constructor(private readonly config: FloorplanSymbolFirestoreServiceConfig) {}

  private docRef(symbolId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_SYMBOLS, symbolId);
  }

  /** Real-time subscription scoped to `(projectId, floorplanId)`. */
  subscribeFloorplanSymbols(
    onChange: (symbols: readonly FloorplanSymbolDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<FloorplanSymbolDoc>(
      'FLOORPLAN_SYMBOLS',
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
   * Persist a new symbol or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateFloorplanSymbolId()` when no `id` supplied.
   */
  async saveFloorplanSymbol(input: FloorplanSymbolSaveInput): Promise<FloorplanSymbolDoc> {
    const id = input.id ?? generateFloorplanSymbolId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      floorplanId: this.config.floorplanId,
      category: input.category,
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
    return base as unknown as FloorplanSymbolDoc;
  }

  async updateFloorplanSymbol(symbolId: string, patch: FloorplanSymbolUpdateInput): Promise<void> {
    const ref = this.docRef(symbolId);
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

  async deleteFloorplanSymbol(symbolId: string): Promise<void> {
    await deleteDoc(this.docRef(symbolId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createFloorplanSymbolFirestoreService(
  config: FloorplanSymbolFirestoreServiceConfig,
): FloorplanSymbolFirestoreService {
  return new FloorplanSymbolFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `FloorplanSymbolEntity` to `FloorplanSymbolSaveInput`.
 * Re-derivable `geometry` intentionally omitted — recomputed client-side on
 * hydrate.
 */
export function entityToSaveInput(entity: FloorplanSymbolEntity): FloorplanSymbolSaveInput {
  return {
    id: entity.id,
    category: entity.params.category,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
