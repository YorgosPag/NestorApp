'use client';

/**
 * ADR-358 Phase 7.5 — Stair Library Presets SSoT writer/reader (G26, Q32).
 *
 * Path: `companies/{companyId}/stair_presets/{presetId}`.
 * 3-scope model resolved Day-1 (Q32): user / company / project. All three are
 * stored in the same subcollection; the `scope` field discriminates.
 *
 * Industry convergence (Revit Types, ArchiCAD Favorites, Vectorworks Resource
 * Manager, AutoCAD Style Manager, BricsCAD Properties): 5/5 vendors support
 * floating-palette preset libraries with user/company-scoped reuse.
 *
 * SOS N.6 — enterprise IDs ONLY: `setDoc()` + `generateStairPresetId()`.
 * Auto-id writes (`add` variant) are forbidden by pre-commit ratchet.
 *
 * Cache TTL: 5min per `listPresets()` call. Invalidated on every write.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 #7, §6.6, §9.2 Q32
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateStairPresetId } from '@/services/enterprise-id.service';
import type {
  StairKind,
  StairParams,
  StairPresetDoc,
  StairPresetScope,
} from '../../types/stair';

// ============================================================================
// CONFIG
// ============================================================================

export interface StairPresetsServiceConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

export interface SavePresetInput {
  readonly name: string;
  readonly kind: StairKind;
  readonly scope: StairPresetScope;
  readonly params: Omit<StairParams, 'basePoint' | 'direction'>;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// CONVERTERS
// ============================================================================

function snapshotToPreset(snap: QueryDocumentSnapshot<DocumentData>): StairPresetDoc {
  const data = snap.data();
  return data as StairPresetDoc;
}

// ============================================================================
// SERVICE
// ============================================================================

export class StairPresetsService {
  private cache: { readonly presets: readonly StairPresetDoc[]; readonly ts: number } | null = null;

  constructor(private readonly config: StairPresetsServiceConfig) {}

  private collectionRef() {
    return collection(db, COLLECTIONS.COMPANIES, this.config.companyId, COLLECTIONS.STAIR_PRESETS);
  }

  private docRef(presetId: string) {
    return doc(db, COLLECTIONS.COMPANIES, this.config.companyId, COLLECTIONS.STAIR_PRESETS, presetId);
  }

  /**
   * Returns presets visible to the current actor: own user-scope + all
   * company-scope + project-scope matching `config.projectId` (if provided).
   * Firestore rules enforce tenant isolation; this method narrows by scope.
   */
  async listPresets(): Promise<readonly StairPresetDoc[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < CACHE_TTL_MS) {
      return this.cache.presets;
    }

    const buckets = await Promise.all([
      this.fetchUserScope(),
      this.fetchCompanyScope(),
      this.config.projectId ? this.fetchProjectScope(this.config.projectId) : Promise.resolve([]),
    ]);

    const merged: StairPresetDoc[] = [];
    for (const bucket of buckets) merged.push(...bucket);

    this.cache = { presets: merged, ts: now };
    return merged;
  }

  private async fetchUserScope(): Promise<readonly StairPresetDoc[]> {
    const q = query(
      this.collectionRef(),
      where('companyId', '==', this.config.companyId),
      where('scope', '==', 'user'),
      where('ownerId', '==', this.config.userId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(snapshotToPreset);
  }

  private async fetchCompanyScope(): Promise<readonly StairPresetDoc[]> {
    const q = query(
      this.collectionRef(),
      where('companyId', '==', this.config.companyId),
      where('scope', '==', 'company'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(snapshotToPreset);
  }

  private async fetchProjectScope(projectId: string): Promise<readonly StairPresetDoc[]> {
    const q = query(
      this.collectionRef(),
      where('companyId', '==', this.config.companyId),
      where('scope', '==', 'project'),
      where('projectId', '==', projectId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(snapshotToPreset);
  }

  async savePreset(input: SavePresetInput): Promise<StairPresetDoc> {
    if (!input.name.trim()) {
      throw new Error('STAIR_PRESET_NAME_REQUIRED');
    }
    if (input.scope === 'project' && !this.config.projectId) {
      throw new Error('STAIR_PRESET_PROJECT_SCOPE_REQUIRES_PROJECT_ID');
    }

    const id = generateStairPresetId();
    const ref = this.docRef(id);

    // Firestore rejects `undefined`. `projectId` only persisted when scope=project.
    const base = {
      id,
      name: input.name.trim(),
      scope: input.scope,
      ownerId: this.config.userId,
      companyId: this.config.companyId,
      kind: input.kind,
      params: input.params,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };
    const payload =
      input.scope === 'project' && this.config.projectId
        ? { ...base, projectId: this.config.projectId }
        : base;

    await setDoc(ref, payload);
    this.invalidateCache();

    return payload as unknown as StairPresetDoc;
  }

  async deletePreset(presetId: string): Promise<void> {
    await deleteDoc(this.docRef(presetId));
    this.invalidateCache();
  }

  invalidateCache(): void {
    this.cache = null;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createStairPresetsService(
  config: StairPresetsServiceConfig,
): StairPresetsService {
  return new StairPresetsService(config);
}
