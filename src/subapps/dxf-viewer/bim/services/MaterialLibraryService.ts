'use client';

/**
 * ADR-363 Phase 6.5 — BIM Material Library SSoT writer/reader.
 *
 * Root collection `bim_materials/{materialId}` με 3-scope discrimination via
 * `scope` field. System docs έχουν `companyId: null, projectId: null` —
 * readable σε όλους τους authenticated users (Firestore rules).
 *
 * ADR-652 M2 — Ο ΚΟΙΝΟΣ πυρήνας (multi-scope list/subscribe/CRUD + cache +
 * builtin guard) ζει πλέον στον {@link ScopedLibraryService}: εδώ μένει ΜΟΝΟ ό,τι
 * είναι υλικό-specific (payload shape, validation, error codes). Δεύτερος
 * καταναλωτής του ίδιου πυρήνα: `BlockLibraryService` (block_library).
 *
 * SOS N.6: setDoc + enterprise ID only (no addDoc, no inline UUID).
 * Cache TTL 5min — invalidated on every write (πυρήνας). Subscribe equality guard
 * (memory rule `feedback_firestore_subscribe_equality_guard`).
 *
 * @see ./scoped-library-service.ts — ο κοινός πυρήνας
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Q8 §Phase 6.5
 */

import { type Unsubscribe } from 'firebase/firestore';

import { generateBimMaterialId } from '@/services/enterprise-id.service';
import {
  BIM_MATERIAL_ERRORS,
  type BimMaterial,
  type SaveBimMaterialInput,
  type UpdateBimMaterialPatch,
} from '../types/bim-material-types';
import {
  ScopedLibraryService,
  companyScopeBucket,
  optionalProjectScopeBucket,
  systemScopeBucket,
} from './scoped-library-service';

// ============================================================================
// CONFIG
// ============================================================================

export interface MaterialLibraryServiceConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MaterialLibraryService {
  private readonly library: ScopedLibraryService<BimMaterial>;

  constructor(private readonly config: MaterialLibraryServiceConfig) {
    this.library = new ScopedLibraryService<BimMaterial>({
      collectionKey: 'BIM_MATERIALS',
      companyId: config.companyId,
      userId: config.userId,
      // Υλικά: system (seeded γενικά) + εταιρείας + (προαιρετικά) έργου.
      buckets: [
        systemScopeBucket(),
        companyScopeBucket(),
        ...optionalProjectScopeBucket(config.projectId),
      ],
      errors: {
        notFound: BIM_MATERIAL_ERRORS.NOT_FOUND,
        builtinNotMutable: BIM_MATERIAL_ERRORS.BUILTIN_NOT_MUTABLE,
      },
    });
  }

  /**
   * Returns merged materials visible to the current actor: system (all) +
   * company-scope (own company) + project-scope (matching projectId if set).
   */
  listMaterials(): Promise<readonly BimMaterial[]> {
    return this.library.list();
  }

  /** Live merge subscriber for the editor UI (system + company + optional project). */
  subscribeMaterials(
    cb: (materials: readonly BimMaterial[]) => void,
    onError: (error: Error) => void = () => {},
  ): Unsubscribe {
    return this.library.subscribe(cb, onError);
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
    const created = await this.library.create(id, {
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
      thumbnailUrl: input.thumbnailUrl ?? null,
      pbrTextures: input.pbrTextures ?? null,
      // ADR-687 Φ1 — per-material appearance (null → category fallback, back-compat).
      appearance: input.appearance ?? null,
      projectId: input.scope === 'project' ? (this.config.projectId ?? null) : null,
    });

    return created as unknown as BimMaterial;
  }

  /** Patches a non-builtin material. Builtin (system seed) rejected. */
  updateMaterial(materialId: string, patch: UpdateBimMaterialPatch): Promise<void> {
    return this.library.patch(materialId, { ...patch });
  }

  /** Deletes a non-builtin material. Builtin rejected. */
  deleteMaterial(materialId: string): Promise<void> {
    return this.library.remove(materialId);
  }

  getMaterialById(materialId: string): Promise<BimMaterial | null> {
    return this.library.getById(materialId);
  }

  invalidateCache(): void {
    this.library.invalidateCache();
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
