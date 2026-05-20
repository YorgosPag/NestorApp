'use client';

/**
 * ADR-363 Phase 6.5 — BIM Material Library SSoT writer/reader.
 *
 * Root collection `bim_materials/{materialId}` με 3-scope discrimination via
 * `scope` field. System docs έχουν `companyId: null, projectId: null` —
 * readable σε όλους τους authenticated users (Firestore rules:3704-3723).
 *
 * Mirror του `StairPresetsService` (ADR-358 Phase 7.5) pattern, αλλά:
 *   - Root collection αντί subcollection (system scope NA σε per-company path).
 *   - 3-listener subscribe για live merge στο editor UI.
 *   - Builtin guard: system-seeded entries non-mutable / non-deletable από client.
 *
 * SOS N.6: setDoc + enterprise ID only (no addDoc, no inline UUID).
 * Cache TTL 5min — invalidated on every write. Subscribe equality guard
 * (memory rule `feedback_firestore_subscribe_equality_guard`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Q8 §Phase 6.5
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBimMaterialId } from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  BIM_MATERIAL_ERRORS,
  type BimMaterial,
  type SaveBimMaterialInput,
  type UpdateBimMaterialPatch,
} from '../types/bim-material-types';

// ============================================================================
// CONFIG
// ============================================================================

export interface MaterialLibraryServiceConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// CONVERTERS
// ============================================================================

function snapshotToMaterial(snap: QueryDocumentSnapshot<DocumentData>): BimMaterial {
  return snap.data() as BimMaterial;
}

/** Snapshot key για equality guard στο subscribe merge. */
function buildEqualityKey(materials: readonly BimMaterial[]): string {
  return materials
    .map((m) => `${m.id}:${m.updatedAt?.toMillis?.() ?? 0}`)
    .join('|');
}

/** Strip undefined από patch — Firestore rejects undefined. */
function stripUndefined(patch: UpdateBimMaterialPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MaterialLibraryService {
  private cache: { readonly materials: readonly BimMaterial[]; readonly ts: number } | null = null;

  constructor(private readonly config: MaterialLibraryServiceConfig) {}

  private collectionRef() {
    return collection(db, COLLECTIONS.BIM_MATERIALS);
  }

  private docRef(materialId: string) {
    return doc(db, COLLECTIONS.BIM_MATERIALS, materialId);
  }

  /**
   * Returns merged materials visible to the current actor: system (all) +
   * company-scope (own company) + project-scope (matching projectId if set).
   * Firestore rules enforce tenant isolation; this method narrows by scope.
   */
  async listMaterials(): Promise<readonly BimMaterial[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < CACHE_TTL_MS) {
      return this.cache.materials;
    }

    const buckets = await Promise.all([
      this.fetchSystemScope(),
      this.fetchCompanyScope(),
      this.config.projectId ? this.fetchProjectScope(this.config.projectId) : Promise.resolve([]),
    ]);

    const merged: BimMaterial[] = [];
    for (const bucket of buckets) merged.push(...bucket);

    this.cache = { materials: merged, ts: now };
    return merged;
  }

  /**
   * Live merge subscriber for the editor UI. Three firestoreQueryService
   * subscriptions (system + company + optional project) με merge + equality
   * guard — SSoT subscribe per `firestore-realtime` module (ADR-355).
   */
  subscribeMaterials(
    cb: (materials: readonly BimMaterial[]) => void,
    onError: (error: Error) => void = () => {},
  ): Unsubscribe {
    let systemDocs: readonly BimMaterial[] = [];
    let companyDocs: readonly BimMaterial[] = [];
    let projectDocs: readonly BimMaterial[] = [];
    let lastKey = '__INITIAL__';

    const emit = (): void => {
      const merged: BimMaterial[] = [];
      merged.push(...systemDocs, ...companyDocs, ...projectDocs);
      const key = buildEqualityKey(merged);
      if (key === lastKey) return;
      lastKey = key;
      this.cache = { materials: merged, ts: Date.now() };
      cb(merged);
    };

    const unsubSystem = firestoreQueryService.subscribe<BimMaterial>(
      'BIM_MATERIALS',
      (result) => {
        systemDocs = result.documents;
        emit();
      },
      onError,
      {
        constraints: [where('scope', '==', 'system')],
        tenantOverride: 'skip',
      },
    );

    const unsubCompany = firestoreQueryService.subscribe<BimMaterial>(
      'BIM_MATERIALS',
      (result) => {
        companyDocs = result.documents;
        emit();
      },
      onError,
      {
        constraints: [where('scope', '==', 'company')],
      },
    );

    let unsubProject: Unsubscribe = () => {};
    if (this.config.projectId) {
      const projectId = this.config.projectId;
      unsubProject = firestoreQueryService.subscribe<BimMaterial>(
        'BIM_MATERIALS',
        (result) => {
          projectDocs = result.documents;
          emit();
        },
        onError,
        {
          constraints: [
            where('scope', '==', 'project'),
            where('projectId', '==', projectId),
          ],
        },
      );
    }

    return () => {
      unsubSystem();
      unsubCompany();
      unsubProject();
    };
  }

  private async fetchSystemScope(): Promise<readonly BimMaterial[]> {
    const q = query(this.collectionRef(), where('scope', '==', 'system'));
    const snap = await getDocs(q);
    return snap.docs.map(snapshotToMaterial);
  }

  private async fetchCompanyScope(): Promise<readonly BimMaterial[]> {
    const q = query(
      this.collectionRef(),
      where('scope', '==', 'company'),
      where('companyId', '==', this.config.companyId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(snapshotToMaterial);
  }

  private async fetchProjectScope(projectId: string): Promise<readonly BimMaterial[]> {
    const q = query(
      this.collectionRef(),
      where('scope', '==', 'project'),
      where('companyId', '==', this.config.companyId),
      where('projectId', '==', projectId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(snapshotToMaterial);
  }

  /**
   * Creates a new company-scope ή project-scope material. System scope
   * REJECTED — system entries seeded once via Admin SDK (`scripts/seed-bim-materials.ts`).
   */
  async saveMaterial(input: SaveBimMaterialInput): Promise<BimMaterial> {
    if (!input.nameEl.trim() || !input.nameEn.trim()) {
      throw new Error(BIM_MATERIAL_ERRORS.NAME_REQUIRED);
    }
    // Defensive runtime guard — TS prevents this via `Exclude<…, 'system'>`,
    // but unsafe casts could bypass. Mirror N.0.1 belt-and-suspenders.
    if ((input.scope as string) === 'system') {
      throw new Error(BIM_MATERIAL_ERRORS.SYSTEM_SCOPE_CLIENT_FORBIDDEN);
    }
    if (input.scope === 'project' && !this.config.projectId) {
      throw new Error(BIM_MATERIAL_ERRORS.PROJECT_SCOPE_REQUIRES_PROJECT_ID);
    }

    const id = generateBimMaterialId();
    const ref = this.docRef(id);

    const payload = {
      id,
      scope: input.scope,
      nameEl: input.nameEl.trim(),
      nameEn: input.nameEn.trim(),
      category: input.category,
      density: input.density ?? null,
      defaultThickness: input.defaultThickness ?? null,
      fireRating: input.fireRating ?? 'none',
      atoeCategory: input.atoeCategory,
      atoeArticle: input.atoeArticle ?? null,
      defaultUnitCost: input.defaultUnitCost ?? null,
      defaultUnit: input.defaultUnit,
      brand: input.brand ?? null,
      brandModel: input.brandModel ?? null,
      notes: input.notes ?? null,
      builtin: false,
      companyId: this.config.companyId,
      projectId: input.scope === 'project' ? (this.config.projectId ?? null) : null,
      createdBy: this.config.userId,
      createdAt: serverTimestamp(),
      updatedBy: this.config.userId,
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    this.invalidateCache();

    return payload as unknown as BimMaterial;
  }

  /** Patches a non-builtin material. Builtin (system seed) rejected. */
  async updateMaterial(materialId: string, patch: UpdateBimMaterialPatch): Promise<void> {
    const ref = this.docRef(materialId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error(BIM_MATERIAL_ERRORS.NOT_FOUND);
    }
    const current = snap.data() as BimMaterial;
    if (current.builtin) {
      throw new Error(BIM_MATERIAL_ERRORS.BUILTIN_NOT_MUTABLE);
    }

    const cleaned = stripUndefined(patch);
    await setDoc(
      ref,
      {
        ...cleaned,
        updatedBy: this.config.userId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    this.invalidateCache();
  }

  /** Deletes a non-builtin material. Builtin rejected. */
  async deleteMaterial(materialId: string): Promise<void> {
    const ref = this.docRef(materialId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error(BIM_MATERIAL_ERRORS.NOT_FOUND);
    }
    const current = snap.data() as BimMaterial;
    if (current.builtin) {
      throw new Error(BIM_MATERIAL_ERRORS.BUILTIN_NOT_MUTABLE);
    }
    await deleteDoc(ref);
    this.invalidateCache();
  }

  async getMaterialById(materialId: string): Promise<BimMaterial | null> {
    const snap = await getDoc(this.docRef(materialId));
    return snap.exists() ? (snap.data() as BimMaterial) : null;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMaterialLibraryService(
  config: MaterialLibraryServiceConfig,
): MaterialLibraryService {
  return new MaterialLibraryService(config);
}
