'use client';

/**
 * ADR-441 Slice 1 — Grid (guides) Firestore persistence SSoT.
 *
 * Path: top-level `floorplan_grid_guides/{grd_*}` (companyId-scoped via field,
 * 1 doc/floor). Mirror του `FoundationFirestoreService`, αλλά **single-doc** (όλος
 * ο κάναβος embedded), όχι per-entity collection.
 *
 * Subscribe → `firestoreQueryService.subscribe('FLOORPLAN_GRID_GUIDES', …)` με
 * `(projectId, floorId||floorplanId)` constraints (ADR-420). Tenant `companyId`
 * auto-applied (CHECK 3.10). Επιστρέφει 0 ή 1 doc ανά scope.
 *
 * Writes → direct SDK (`setDoc` first / `updateDoc` after) + `generateGridGuideDocId`
 * (enterprise-id, SOS N.6). createAt immutable → setDoc μόνο στο first write.
 *
 * @see ./guide-persistence-types.ts
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateGridGuideDocId } from '@/services/enterprise-id-convenience';
import { firestoreQueryService } from '@/services/firestore';
import {
  buildBimScopeConstraints,
  bimScopeWriteFields,
} from '../../bim/persistence/bim-floor-scope';
import type { GridGuideDoc, GuideSnapshot } from './guide-persistence-types';
import type { GuideGroup } from './guide-types';

// ============================================================================
// TYPES
// ============================================================================

export interface GridGuideServiceConfig {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId?: string;
  readonly userId: string;
}

export interface GridGuideSaveInput {
  /** Existing doc id (update) ή undefined (first write → generate). */
  readonly id?: string;
  readonly guides: readonly GuideSnapshot[];
  readonly groups: readonly GuideGroup[];
  readonly version: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class GridGuideFirestoreService {
  constructor(private readonly config: GridGuideServiceConfig) {}

  private docRef(docId: string) {
    return doc(db, COLLECTIONS.FLOORPLAN_GRID_GUIDES, docId);
  }

  /** Real-time subscription scoped σε `(projectId, floorId||floorplanId)`. 0 ή 1 doc. */
  subscribeGrid(
    onChange: (docs: readonly GridGuideDoc[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<GridGuideDoc>(
      'FLOORPLAN_GRID_GUIDES',
      (result) => onChange(result.documents),
      onError,
      { constraints: buildBimScopeConstraints(this.config) },
    );
  }

  /** First write — stamps createdAt (immutable). Enterprise-id όταν δεν δοθεί id. */
  async createGrid(input: GridGuideSaveInput): Promise<string> {
    const id = input.id ?? generateGridGuideDocId();
    await setDoc(this.docRef(id), {
      id,
      companyId: this.config.companyId,
      projectId: this.config.projectId,
      ...bimScopeWriteFields(this.config),
      guides: input.guides,
      groups: input.groups,
      version: input.version,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });
    return id;
  }

  /** Subsequent writes — overwrite guides/groups (createdAt left intact). */
  async updateGrid(docId: string, input: GridGuideSaveInput): Promise<void> {
    await updateDoc(this.docRef(docId), {
      guides: input.guides,
      groups: input.groups,
      version: input.version,
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteGrid(docId: string): Promise<void> {
    await deleteDoc(this.docRef(docId));
  }
}

export function createGridGuideFirestoreService(
  config: GridGuideServiceConfig,
): GridGuideFirestoreService {
  return new GridGuideFirestoreService(config);
}
