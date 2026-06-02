'use client';

/**
 * ADR-408 Φ2 — MEP system Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_mep_systems/{systemId}` (companyId-scoped via
 * field). Mirrors `MepFixtureFirestoreService` but carries NO geometry (a
 * system is a logical network). Re-uses `firestoreQueryService` (ADR-355).
 *
 * Writes → direct Firestore SDK (`setDoc` + `generateMepSystemId`) for the
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
import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import type { MepSystemEntity, MepSystemParams } from '../types/mep-system-types';

// ============================================================================
// TYPES
// ============================================================================

/** Canonical Firestore document shape for a persisted MEP system (no geometry). */
export interface MepSystemDoc {
  readonly id: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly params: MepSystemParams;
  readonly createdAt: Timestamp;
  readonly createdBy: string;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface MepSystemFirestoreServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly userId: string;
}

export interface MepSystemSaveInput {
  readonly id?: string;
  readonly params: MepSystemParams;
}

export interface MepSystemUpdateInput {
  readonly params: MepSystemParams;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MepSystemFirestoreService {
  constructor(private readonly config: MepSystemFirestoreServiceConfig) {}

  private docRef(systemId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_MEP_SYSTEMS, systemId);
  }

  /** Real-time subscription scoped to `(projectId, floorplanId)`. */
  subscribeSystems(
    onChange: (systems: readonly MepSystemDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<MepSystemDoc>(
      'FLOORPLAN_MEP_SYSTEMS',
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
   * Persist a new system or overwrite an existing one (id-preserving).
   * Enterprise-id (SOS N.6): `generateMepSystemId()` when no `id` is supplied.
   */
  async saveSystem(input: MepSystemSaveInput): Promise<MepSystemDoc> {
    const id = input.id ?? generateMepSystemId();
    const ref = this.docRef(id);

    const base: Record<string, unknown> = {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      floorplanId: this.config.floorplanId,
      params: input.params,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, base);
    return base as unknown as MepSystemDoc;
  }

  async updateSystem(systemId: string, patch: MepSystemUpdateInput): Promise<void> {
    await updateDoc(this.docRef(systemId), {
      params: patch.params,
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteSystem(systemId: string): Promise<void> {
    await deleteDoc(this.docRef(systemId));
  }
}

// ============================================================================
// FACTORY + HELPERS
// ============================================================================

export function createMepSystemFirestoreService(
  config: MepSystemFirestoreServiceConfig,
): MepSystemFirestoreService {
  return new MepSystemFirestoreService(config);
}

/** Build a scene-side `MepSystemEntity` from a persisted `MepSystemDoc`. */
export function docToSystemEntity(d: MepSystemDoc): MepSystemEntity {
  return {
    id: d.id,
    params: d.params,
    companyId: d.companyId,
    projectId: d.projectId,
    floorplanId: d.floorplanId,
    createdAt: d.createdAt,
    createdBy: d.createdBy,
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy,
  };
}
