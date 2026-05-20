'use client';

/**
 * ADR-358 §5.9 Q12 — DXF Layer State Templates Firestore CRUD service
 * (Phase 13B.1, client-side, tenant-scoped).
 *
 * Persists `LayerStateTemplate` documents in a root collection
 * `dxf_layer_state_templates/{templateId}` with strict `companyId` isolation
 * (ADR-294 multi-tenant pattern). Pairs with the `dxf_template_categories`
 * catalog (free-string + auto-create on novel category).
 *
 * Permission model (firestore.rules + service-layer defence-in-depth):
 *   - READ          : any tenant member.
 *   - CREATE        : company_admin+ (rules-enforced).
 *   - UPDATE/DELETE : company_admin+ (rules-enforced).
 *   - SOFT DELETE   : UPDATE setting `deletedAt = nowISO()`. Hard delete via
 *                     dedicated `hardDeleteTemplate()` reserved for the 30-day
 *                     purge background job (Phase 13B.3 / future ADR-363).
 *
 * SOS N.6 — enterprise IDs ONLY: writes use `setDoc(doc(col, generateXxxId()))`.
 * The banned auto-ID function is forbidden by pre-commit ratchet.
 *
 * Cache TTL: 5min per `listTemplateSummaries()` / `listCategories()`.
 * Invalidated on every mutation in this service instance.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-layer-management-system.md §5.9 + §7.2 row 13B
 * @see src/subapps/dxf-viewer/types/layer-state-template.ts
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { compareByLocale } from '@/lib/intl-formatting';
import {
  createDxfTemplateCategory,
  createLayerStateTemplate,
  normalizeCategory,
  toLayerStateTemplateSummary,
  type DxfTemplateCategory,
  type LayerStateTemplate,
  type LayerStateTemplateSummary,
} from '@/subapps/dxf-viewer/types/layer-state-template';
import type { LayerStateEntry } from '@/subapps/dxf-viewer/types/layer-state';

// ─── Config & errors ─────────────────────────────────────────────────────────

export interface DxfLayerStateTemplateServiceConfig {
  readonly companyId: string;
  readonly userId: string;
}

export interface SaveAsTemplateInput {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly snapshot: ReadonlyArray<LayerStateEntry>;
  readonly sourceStateId?: string;
}

export interface SearchTemplatesQuery {
  readonly category?: string;
  /** Up to 10 tags per Firestore `array-contains-any` limit. */
  readonly tags?: ReadonlyArray<string>;
  readonly includeDeleted?: boolean;
}

export class LayerStateTemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Layer state template not found: ${templateId}`);
    this.name = 'LayerStateTemplateNotFoundError';
  }
}

export class LayerStateTemplateCrossTenantError extends Error {
  constructor(templateId: string, expected: string, actual: string) {
    super(
      `Cross-tenant access denied on template ${templateId}: expected companyId=${expected}, got ${actual}`,
    );
    this.name = 'LayerStateTemplateCrossTenantError';
  }
}

export class LayerStateTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayerStateTemplateValidationError';
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const TAGS_ARRAY_CONTAINS_LIMIT = 10;

// ─── Converters ──────────────────────────────────────────────────────────────

function snapshotToTemplate(snap: QueryDocumentSnapshot<DocumentData>): LayerStateTemplate {
  return snap.data() as LayerStateTemplate;
}

function snapshotToCategory(snap: QueryDocumentSnapshot<DocumentData>): DxfTemplateCategory {
  return snap.data() as DxfTemplateCategory;
}

function assertSameTenant(
  templateId: string,
  expectedCompanyId: string,
  doc: LayerStateTemplate,
): void {
  if (doc.companyId !== expectedCompanyId) {
    throw new LayerStateTemplateCrossTenantError(templateId, expectedCompanyId, doc.companyId);
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class DxfLayerStateTemplateService {
  private templatesCache: {
    readonly summaries: readonly LayerStateTemplateSummary[];
    readonly ts: number;
  } | null = null;
  private categoriesCache: {
    readonly categories: readonly DxfTemplateCategory[];
    readonly ts: number;
  } | null = null;

  constructor(private readonly config: DxfLayerStateTemplateServiceConfig) {}

  private templatesCol() {
    return collection(db, COLLECTIONS.DXF_LAYER_STATE_TEMPLATES);
  }

  private templateDoc(templateId: string) {
    return doc(db, COLLECTIONS.DXF_LAYER_STATE_TEMPLATES, templateId);
  }

  private categoriesCol() {
    return collection(db, COLLECTIONS.DXF_TEMPLATE_CATEGORIES);
  }

  private categoryDoc(categoryId: string) {
    return doc(db, COLLECTIONS.DXF_TEMPLATE_CATEGORIES, categoryId);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /**
   * List template summaries visible to the current tenant. Filters by category
   * / tags when provided; soft-deleted entries excluded by default.
   */
  async listTemplateSummaries(q: SearchTemplatesQuery = {}): Promise<readonly LayerStateTemplateSummary[]> {
    const wantsFiltered = Boolean(q.category) || (q.tags?.length ?? 0) > 0 || q.includeDeleted;
    if (!wantsFiltered) {
      const cached = this.readTemplatesCache();
      if (cached) return cached;
    }

    const constraints: QueryConstraint[] = [
      // companyId — tenant isolation (firestore.rules CHECK 3.10 inline-required)
      where('companyId', '==', this.config.companyId),
    ];
    if (q.category) {
      constraints.push(where('category', '==', normalizeCategory(q.category)));
    }
    if (q.tags && q.tags.length > 0) {
      const tagSlice = q.tags.slice(0, TAGS_ARRAY_CONTAINS_LIMIT);
      constraints.push(where('tags', 'array-contains-any', tagSlice));
    }

    const docsSnap = await getDocs(query(this.templatesCol(), ...constraints));
    const all = docsSnap.docs.map(snapshotToTemplate);
    const visible = q.includeDeleted ? all : all.filter((t) => !t.deletedAt);
    const summaries = visible
      .map(toLayerStateTemplateSummary)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    if (!wantsFiltered) {
      this.templatesCache = { summaries, ts: Date.now() };
    }
    return summaries;
  }

  /**
   * Fetch the full document (snapshot included) for use by `importTemplate`
   * in the LayerStateStore (Phase 13B.2 consumer).
   */
  async getTemplate(templateId: string): Promise<LayerStateTemplate> {
    const snap = await getDoc(this.templateDoc(templateId));
    if (!snap.exists()) throw new LayerStateTemplateNotFoundError(templateId);
    const t = snap.data() as LayerStateTemplate;
    assertSameTenant(templateId, this.config.companyId, t);
    return t;
  }

  async listCategories(): Promise<readonly DxfTemplateCategory[]> {
    const cached = this.readCategoriesCache();
    if (cached) return cached;
    // companyId — tenant isolation (firestore.rules CHECK 3.10 inline-required)
    const q = query(this.categoriesCol(), where('companyId', '==', this.config.companyId));
    const snap = await getDocs(q);
    const categories = snap.docs.map(snapshotToCategory).sort((a, b) => compareByLocale(a.value, b.value));
    this.categoriesCache = { categories, ts: Date.now() };
    return categories;
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  async saveAsTemplate(input: SaveAsTemplateInput): Promise<LayerStateTemplate> {
    if (!input.name.trim()) {
      throw new LayerStateTemplateValidationError('LAYER_STATE_TEMPLATE_NAME_REQUIRED');
    }
    if (input.snapshot.length === 0) {
      throw new LayerStateTemplateValidationError('LAYER_STATE_TEMPLATE_EMPTY_SNAPSHOT');
    }

    const template = createLayerStateTemplate({
      companyId: this.config.companyId,
      name: input.name.trim(),
      description: input.description,
      category: input.category,
      tags: input.tags,
      snapshot: input.snapshot,
      sourceStateId: input.sourceStateId,
      createdBy: this.config.userId,
    });

    await setDoc(this.templateDoc(template.id), template);
    await this.ensureCategoryRegistered(template.category);
    this.invalidateTemplatesCache();
    return template;
  }

  /**
   * Patch an existing template. `companyId` is immutable (firestore.rules
   * enforce). When `category` changes, the catalog is updated to register
   * the new value if novel.
   */
  async updateTemplate(
    templateId: string,
    patch: Partial<Pick<LayerStateTemplate, 'name' | 'description' | 'category' | 'tags'>>,
  ): Promise<LayerStateTemplate> {
    const before = await this.getTemplate(templateId);
    const writePayload: Record<string, unknown> = {
      updatedAt: nowISO(),
      updatedBy: this.config.userId,
    };
    if (patch.name !== undefined) writePayload.name = patch.name.trim();
    if (patch.description !== undefined) writePayload.description = patch.description;
    if (patch.category !== undefined) writePayload.category = normalizeCategory(patch.category);
    if (patch.tags !== undefined) writePayload.tags = patch.tags.slice();

    await updateDoc(this.templateDoc(templateId), writePayload);
    if (patch.category !== undefined) {
      await this.ensureCategoryRegistered(normalizeCategory(patch.category));
    }
    this.invalidateTemplatesCache();
    return { ...before, ...(writePayload as Partial<LayerStateTemplate>) };
  }

  /** Soft-delete: set `deletedAt = nowISO()`. Recoverable via `restoreTemplate`. */
  async softDeleteTemplate(templateId: string): Promise<void> {
    await this.getTemplate(templateId);
    await updateDoc(this.templateDoc(templateId), {
      deletedAt: nowISO(),
      updatedAt: nowISO(),
      updatedBy: this.config.userId,
    });
    this.invalidateTemplatesCache();
  }

  /** Clear `deletedAt` on a previously soft-deleted template. */
  async restoreTemplate(templateId: string): Promise<void> {
    await this.getTemplate(templateId);
    await updateDoc(this.templateDoc(templateId), {
      deletedAt: null,
      updatedAt: nowISO(),
      updatedBy: this.config.userId,
    });
    this.invalidateTemplatesCache();
  }

  /**
   * Hard delete — intended for the 30-day purge background job and admin
   * "empty trash" operations. Bypasses the soft-delete window.
   */
  async hardDeleteTemplate(templateId: string): Promise<void> {
    await this.getTemplate(templateId);
    await deleteDoc(this.templateDoc(templateId));
    this.invalidateTemplatesCache();
  }

  // ─── Category catalog ──────────────────────────────────────────────────────

  /**
   * Idempotent: register `value` in the per-company catalog if not present.
   * Built-in preset categories are NOT persisted — they live in code (see
   * `PRESET_CATEGORIES`).
   */
  async ensureCategoryRegistered(value: string): Promise<void> {
    const canonical = normalizeCategory(value);
    const known = await this.listCategories();
    if (known.some((c) => c.value === canonical)) return;

    const category = createDxfTemplateCategory({
      companyId: this.config.companyId,
      value: canonical,
      createdBy: this.config.userId,
    });
    await setDoc(this.categoryDoc(category.id), category);
    this.invalidateCategoriesCache();
  }

  // ─── Cache helpers ─────────────────────────────────────────────────────────

  private readTemplatesCache(): readonly LayerStateTemplateSummary[] | null {
    if (!this.templatesCache) return null;
    if (Date.now() - this.templatesCache.ts >= CACHE_TTL_MS) return null;
    return this.templatesCache.summaries;
  }

  private readCategoriesCache(): readonly DxfTemplateCategory[] | null {
    if (!this.categoriesCache) return null;
    if (Date.now() - this.categoriesCache.ts >= CACHE_TTL_MS) return null;
    return this.categoriesCache.categories;
  }

  invalidateTemplatesCache(): void {
    this.templatesCache = null;
  }

  invalidateCategoriesCache(): void {
    this.categoriesCache = null;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDxfLayerStateTemplateService(
  config: DxfLayerStateTemplateServiceConfig,
): DxfLayerStateTemplateService {
  return new DxfLayerStateTemplateService(config);
}
