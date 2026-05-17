/**
 * LayerStateTemplate — type SSoT (ADR-358 §5.9 Q12, Phase 13B).
 *
 * Cross-project, company-scoped layer state template. A `LayerStateTemplate`
 * is a saved-state snapshot promoted to the company library so any project in
 * the same tenant can clone it. Storage: root collection
 * `dxf_layer_state_templates/{templateId}` (companyId-scoped, ADR-294
 * multi-tenant). Categories: per-company free-string catalog
 * `dxf_template_categories/{categoryId}` (auto-created when a user saves a
 * template with a category not yet present in the catalog).
 *
 * Permission model (Q&A 2026-05-17):
 *   - Browse / use (read):    every company member.
 *   - Save / edit / delete:   company_admin+ (firestore.rules enforce).
 *   - Soft delete (`deletedAt`): set by UPDATE, 30-day recoverable window.
 *
 * Pre-commit ratchet `layer-state-system` allowlists construction sites:
 * only the factory + the Firestore service may build/persist this shape.
 */

import {
  generateLayerStateTemplateId,
  generateDxfTemplateCategoryId,
} from '@/services/enterprise-id-convenience';
import { nowISO } from '@/lib/date-local';
import type { LayerStateEntry } from './layer-state';

/**
 * Suggested categories shown in the template "Save as…" dropdown. The catalog
 * is free-string — users can type anything; new values are persisted in
 * `dxf_template_categories` and surface in the dropdown on the next read.
 */
export const PRESET_CATEGORIES = Object.freeze([
  'architectural',
  'structural',
  'mep',
  'demolition',
  'presentation',
  'working',
  'custom',
] as const);

export type PresetCategory = typeof PRESET_CATEGORIES[number];

/**
 * Full template document. The `snapshot` carries the same per-layer entries
 * a `LayerState` would — restoring from a template builds a project-local
 * `LayerState` with `source: 'template-shared'` + `sourceTemplateId`.
 */
export interface LayerStateTemplate {
  /** `lstpl_<UUID-v4>` from enterprise-id.service. */
  readonly id: string;
  /** Owning company. Immutable post-create (firestore.rules enforce). */
  readonly companyId: string;
  readonly name: string;
  readonly description?: string;
  /** Free-string category — preset or user-defined. */
  readonly category: string;
  /** Free-text tags for searchTemplates({tags}) array-contains-any. */
  readonly tags: ReadonlyArray<string>;
  /** Full per-layer snapshot, identical shape to LayerState.snapshot. */
  readonly snapshot: ReadonlyArray<LayerStateEntry>;
  /** Original `LayerState.id` at promotion time (audit / trace). */
  readonly sourceStateId?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
  /** ISO timestamp of soft-delete. Null/absent = active. */
  readonly deletedAt?: string | null;
}

/**
 * Lightweight projection used by the template browser. Excludes `snapshot`
 * to keep list payloads small — the browser fetches the full template only
 * when the user confirms "Use this template".
 */
export interface LayerStateTemplateSummary {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly description?: string;
  readonly category: string;
  readonly tags: ReadonlyArray<string>;
  readonly entryCount: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Catalog entry for a per-company template category (free-string + auto-create). */
export interface DxfTemplateCategory {
  /** `lstcat_<UUID-v4>` from enterprise-id.service. */
  readonly id: string;
  readonly companyId: string;
  /** Lowercased + trimmed canonical value — UI may render with original casing. */
  readonly value: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

// ─── Factories ───────────────────────────────────────────────────────────────

/**
 * SSoT factory for `LayerStateTemplate`. The Firestore service is the only
 * persistence entry point; UI / store layers go through it. Construction
 * outside this file (or the test fixtures) is blocked by ratchet
 * `layer-state-system`.
 */
export function createLayerStateTemplate(input: {
  companyId: string;
  name: string;
  snapshot: ReadonlyArray<LayerStateEntry>;
  createdBy: string;
  category?: string;
  description?: string;
  tags?: ReadonlyArray<string>;
  sourceStateId?: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}): LayerStateTemplate {
  const now = nowISO();
  return {
    id: input.id ?? generateLayerStateTemplateId(),
    companyId: input.companyId,
    name: input.name,
    description: input.description,
    category: normalizeCategory(input.category),
    tags: Object.freeze(input.tags ? input.tags.slice() : []) as ReadonlyArray<string>,
    snapshot: Object.freeze(input.snapshot.slice()) as ReadonlyArray<LayerStateEntry>,
    sourceStateId: input.sourceStateId,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? now,
    updatedBy: input.updatedBy ?? input.createdBy,
    updatedAt: input.updatedAt ?? now,
    deletedAt: null,
  };
}

/** Build the listing projection from a full template document. */
export function toLayerStateTemplateSummary(t: LayerStateTemplate): LayerStateTemplateSummary {
  return {
    id: t.id,
    companyId: t.companyId,
    name: t.name,
    description: t.description,
    category: t.category,
    tags: t.tags,
    entryCount: t.snapshot.length,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** SSoT factory for `DxfTemplateCategory`. */
export function createDxfTemplateCategory(input: {
  companyId: string;
  value: string;
  createdBy: string;
  id?: string;
  createdAt?: string;
}): DxfTemplateCategory {
  return {
    id: input.id ?? generateDxfTemplateCategoryId(),
    companyId: input.companyId,
    value: normalizeCategory(input.value),
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? nowISO(),
  };
}

/**
 * Lower-case + trim. Empty / whitespace-only falls back to `'custom'` so the
 * persisted value is always a valid Firestore key segment and survives
 * exact-match `where('category', '==', ...)` queries.
 */
export function normalizeCategory(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().toLowerCase();
  return trimmed === '' ? 'custom' : trimmed;
}
