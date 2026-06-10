'use client';

/**
 * ADR-437 — Space Separator Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_space_separators/{spaceSeparatorId}` (companyId-scoped
 * via field). Mirror του `FoundationFirestoreService` — lightweight, line-based,
 * ΧΩΡΙΣ connectors/BOQ/buildingId. Re-uses `firestoreQueryService.subscribe` SSoT
 * (ADR-355) + ADR-420 floor-scope helper.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_SPACE_SEPARATORS', ...)`
 * με `(projectId, floorId||floorplanId)` constraints. Tenant `companyId`
 * εφαρμόζεται αυτόματα (CHECK 3.10).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateSpaceSeparatorId`) για το
 * enterprise-id contract (SOS N.6).
 *
 * `docToEntity` routes through the **factory** (`createSpaceSeparator`) so IFC
 * fields auto-populate + geometry is always re-derivable (Foundation pattern,
 * cleaner than thermal-space inline construction).
 *
 * @see ../foundations/foundation-firestore-service.ts (πρότυπο)
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
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
import { firestoreQueryService } from '@/services/firestore';
import { generateSpaceSeparatorId } from '@/services/enterprise-id-convenience';
import { createSpaceSeparator } from '@/services/factories/space-separator.factory';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import {
  computeSpaceSeparatorGeometry,
  type SpaceSeparatorEntity,
  type SpaceSeparatorGeometry,
  type SpaceSeparatorKind,
  type SpaceSeparatorParams,
} from '../types/space-separator-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/** Canonical Firestore document shape για a persisted space separator. */
export interface SpaceSeparatorDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: SpaceSeparatorKind;
  readonly params: SpaceSeparatorParams;
  readonly validation: BimValidation;
  readonly geometry?: SpaceSeparatorGeometry;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface SpaceSeparatorFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface SpaceSeparatorSaveInput {
  readonly id?: string;
  readonly kind: SpaceSeparatorKind;
  readonly params: SpaceSeparatorParams;
  readonly validation: BimValidation;
  readonly geometry?: SpaceSeparatorGeometry;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface SpaceSeparatorUpdateInput {
  readonly params?: SpaceSeparatorParams;
  readonly validation?: BimValidation;
  readonly geometry?: SpaceSeparatorGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class SpaceSeparatorFirestoreService {
  constructor(private readonly config: SpaceSeparatorFirestoreServiceConfig) {}

  private docRef(spaceSeparatorId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_SPACE_SEPARATORS, spaceSeparatorId);
  }

  /** Real-time subscription scoped σε `(projectId, floorId||floorplanId)`. */
  subscribeSpaceSeparators(
    onChange: (separators: readonly SpaceSeparatorDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<SpaceSeparatorDoc>(
      'FLOORPLAN_SPACE_SEPARATORS',
      (result) => onChange(result.documents),
      onError,
      {
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /** Persist new separator ή overwrite (id-preserving). Enterprise-id (SOS N.6). */
  async saveSpaceSeparator(input: SpaceSeparatorSaveInput): Promise<SpaceSeparatorDoc> {
    const id = input.id ?? generateSpaceSeparatorId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
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
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as SpaceSeparatorDoc;
  }

  async updateSpaceSeparator(
    spaceSeparatorId: string,
    patch: SpaceSeparatorUpdateInput,
  ): Promise<void> {
    const ref = this.docRef(spaceSeparatorId);
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

  async deleteSpaceSeparator(spaceSeparatorId: string): Promise<void> {
    await deleteDoc(this.docRef(spaceSeparatorId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createSpaceSeparatorFirestoreService(
  config: SpaceSeparatorFirestoreServiceConfig,
): SpaceSeparatorFirestoreService {
  return new SpaceSeparatorFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/** Convert a scene-side `SpaceSeparatorEntity` σε `SpaceSeparatorSaveInput`. */
export function spaceSeparatorEntityToSaveInput(
  entity: SpaceSeparatorEntity,
): SpaceSeparatorSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}

/**
 * Hydrate a Firestore doc → `SpaceSeparatorEntity` via the factory (Foundation
 * pattern). Geometry recomputed από params όταν λείπει.
 */
export function spaceSeparatorDocToEntity(d: SpaceSeparatorDoc): SpaceSeparatorEntity {
  return createSpaceSeparator({
    id: d.id,
    kind: d.kind,
    params: d.params,
    geometry: d.geometry ?? computeSpaceSeparatorGeometry(d.params),
    layerId: d.layerId ?? '0',
    validation: d.validation,
    ...(d.companyId !== undefined && { companyId: d.companyId }),
    ...(d.projectId !== undefined && { projectId: d.projectId }),
    ...(d.floorplanId !== undefined && { floorplanId: d.floorplanId }),
    ...(d.floorId !== undefined && { floorId: d.floorId }),
    ...(d.createdBy !== undefined && { createdBy: d.createdBy }),
    ...(d.updatedBy !== undefined && { updatedBy: d.updatedBy }),
  });
}
