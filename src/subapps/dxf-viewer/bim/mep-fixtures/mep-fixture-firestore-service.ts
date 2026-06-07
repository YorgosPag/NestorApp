'use client';

/**
 * ADR-406 — MEP fixture Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_fixtures/{fixtureId}` (companyId-scoped via
 * field). Mirrors `ColumnFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepFixtureId`) for the
 * enterprise-id contract (SOS N.6). Auto-id writes are forbidden by the SSoT
 * ratchet.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
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
import { generateMepFixtureId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  MepFixtureEntity,
  MepFixtureGeometry,
  MepFixtureKind,
  MepFixtureParams,
} from '../types/mep-fixture-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted MEP fixture. Mirrors
 * `ColumnDoc`: params + validation persisted; geometry optional (re-derivable
 * from `computeMepFixtureGeometry(params)`).
 */
export interface MepFixtureDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: MepFixtureKind;
  readonly params: MepFixtureParams;
  readonly validation: BimValidation;
  readonly geometry?: MepFixtureGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepFixtureFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface MepFixtureSaveInput {
  readonly id?: string;
  readonly kind: MepFixtureKind;
  readonly params: MepFixtureParams;
  readonly validation: BimValidation;
  readonly geometry?: MepFixtureGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface MepFixtureUpdateInput {
  readonly params?: MepFixtureParams;
  readonly validation?: BimValidation;
  readonly geometry?: MepFixtureGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepFixtureFirestoreService {
  constructor(private readonly config: MepFixtureFirestoreServiceConfig) {}

  private docRef(fixtureId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_FIXTURES, fixtureId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribeFixtures(
    onChange: (fixtures: readonly MepFixtureDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepFixtureDoc>(
      'FLOORPLAN_MEP_FIXTURES',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new fixture or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepFixtureId()` when no `id` is supplied.
   */
  async saveFixture(input: MepFixtureSaveInput): Promise<MepFixtureDoc> {
    const id = input.id ?? generateMepFixtureId();
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

    // Firestore rejects `undefined` — include optional fields only when set.
    if (input.geometry !== undefined) base.geometry = input.geometry;
    if (input.buildingId !== undefined) base.buildingId = input.buildingId;
    // ADR-420 — floorId is owned by config scope (bimScopeWriteFields above), not input.
    if (input.layerId !== undefined) base.layerId = input.layerId;

    await setDoc(ref, base);
    return base as unknown as MepFixtureDoc;
  }

  async updateFixture(fixtureId: string, patch: MepFixtureUpdateInput): Promise<void> {
    const ref = this.docRef(fixtureId);
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

  async deleteFixture(fixtureId: string): Promise<void> {
    await deleteDoc(this.docRef(fixtureId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMepFixtureFirestoreService(
  config: MepFixtureFirestoreServiceConfig,
): MepFixtureFirestoreService {
  return new MepFixtureFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `MepFixtureEntity` to `MepFixtureSaveInput`. Re-derivable
 * `geometry` intentionally omitted — recomputed client-side from params on hydrate.
 */
export function entityToSaveInput(entity: MepFixtureEntity): MepFixtureSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
