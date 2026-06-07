'use client';

/**
 * ADR-408 Φ3 — Electrical panel Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_electrical_panels/{panelId}` (companyId-scoped via
 * field). Mirrors `MepFixtureFirestoreService`. Re-uses `firestoreQueryService`
 * SSoT (ADR-355) + ADR-361 equality guard.
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateElectricalPanelId`) for the
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
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateElectricalPanelId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import { buildBimScopeConstraints, bimScopeWriteFields } from '../persistence/bim-floor-scope';
import type {
  ElectricalPanelEntity,
  ElectricalPanelGeometry,
  ElectricalPanelKind,
  ElectricalPanelParams,
} from '../types/electrical-panel-types';
import type { BimValidation } from '../types/bim-base';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canonical Firestore document shape for a persisted electrical panel. Mirrors
 * `MepFixtureDoc`: params + validation persisted; geometry optional
 * (re-derivable from `computeElectricalPanelGeometry(params)`).
 */
export interface ElectricalPanelDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly kind: ElectricalPanelKind;
  readonly params: ElectricalPanelParams;
  readonly validation: BimValidation;
  readonly geometry?: ElectricalPanelGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface ElectricalPanelFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string;
  readonly userId: string;
}

export interface ElectricalPanelSaveInput {
  readonly id?: string;
  readonly kind: ElectricalPanelKind;
  readonly params: ElectricalPanelParams;
  readonly validation: BimValidation;
  readonly geometry?: ElectricalPanelGeometry;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly layerId?: string;
}

export interface ElectricalPanelUpdateInput {
  readonly params?: ElectricalPanelParams;
  readonly validation?: BimValidation;
  readonly geometry?: ElectricalPanelGeometry;
  readonly layerId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ElectricalPanelFirestoreService {
  constructor(private readonly config: ElectricalPanelFirestoreServiceConfig) {}

  private docRef(panelId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_ELECTRICAL_PANELS, panelId);
  }

  /**
   * Real-time subscription scoped to `(projectId, floorplanId)`. Tenant
   * `companyId` auto-applied by `firestoreQueryService`.
   */
  subscribePanels(
    onChange: (panels: readonly ElectricalPanelDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<ElectricalPanelDoc>(
      'FLOORPLAN_ELECTRICAL_PANELS',
      (result) => onChange(result.documents),
      onError,
      {
        // ADR-420 — scoped by stable floorId (fallback floorplanId on floor-less canvas).
        constraints: buildBimScopeConstraints(this.config),
      },
    );
  }

  /**
   * Persist a new panel or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateElectricalPanelId()` when no `id` supplied.
   */
  async savePanel(input: ElectricalPanelSaveInput): Promise<ElectricalPanelDoc> {
    const id = input.id ?? generateElectricalPanelId();
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
    return base as unknown as ElectricalPanelDoc;
  }

  async updatePanel(panelId: string, patch: ElectricalPanelUpdateInput): Promise<void> {
    const ref = this.docRef(panelId);
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

  async deletePanel(panelId: string): Promise<void> {
    await deleteDoc(this.docRef(panelId));
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createElectricalPanelFirestoreService(
  config: ElectricalPanelFirestoreServiceConfig,
): ElectricalPanelFirestoreService {
  return new ElectricalPanelFirestoreService(config);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a scene-side `ElectricalPanelEntity` to `ElectricalPanelSaveInput`.
 * Re-derivable `geometry` intentionally omitted — recomputed client-side from
 * params on hydrate.
 */
export function entityToSaveInput(entity: ElectricalPanelEntity): ElectricalPanelSaveInput {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    validation: entity.validation,
    layerId: entity.layerId,
  };
}
