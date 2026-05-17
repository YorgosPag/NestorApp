/**
 * layer-filter-io.ts — JSON export/import for `LayerFilter` (ADR-358 §5.7.bis Q11, Phase 11).
 *
 * Export emits a versioned envelope `{ version, projectName, exportedAt, filters }`
 * for forward-compat. Import accepts the envelope OR a raw `LayerFilter[]`
 * array (legacy/manual). Validation delegated to `layer-filter-validation.ts`.
 *
 * Dedupe policy (import vs existing): name collision → append `(2)`, `(3)`, …
 * Smart filters are NEVER imported — they are derived at runtime.
 *
 * Pre-commit ratchet `layer-filter-engine` keeps this file in the allowlist.
 */

import type { LayerFilter } from '../types/layer-filters';
import { validateLayerFilterJsonBulk } from './layer-filter-validation';
import { nowISO } from '@/lib/date-local';

export const LAYER_FILTERS_EXPORT_VERSION = 1;

export interface LayerFiltersExportEnvelope {
  readonly version: number;
  readonly projectName: string;
  readonly exportedAt: string; // ISO
  readonly filters: ReadonlyArray<LayerFilter>;
}

/**
 * Serialize user filters into a JSON envelope. Strips smart filters
 * defensively (caller should pre-filter, but we double-check).
 */
export function exportFiltersAsJson(input: {
  filters: ReadonlyArray<LayerFilter>;
  projectName: string;
}): { readonly json: string; readonly filename: string } {
  const userFilters = input.filters.filter((f) => f.source !== 'system-smart');
  const envelope: LayerFiltersExportEnvelope = {
    version: LAYER_FILTERS_EXPORT_VERSION,
    projectName: input.projectName,
    exportedAt: nowISO(),
    filters: userFilters,
  };
  return {
    json: JSON.stringify(envelope, null, 2),
    filename: buildExportFilename(input.projectName),
  };
}

/**
 * Filename pattern: `{projectName}-layer-filters-{YYYY-MM-DD-HHmm}.json`.
 * HH-mm suffix prevents same-day re-export overwriting the browser download.
 * Project name is sanitized to filesystem-safe chars.
 */
export function buildExportFilename(projectName: string, now: Date = new Date()): string {
  const safe = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'project';
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${safe}-layer-filters-${yyyy}-${mm}-${dd}-${hh}${mi}.json`;
}

export interface ImportResult {
  readonly imported: ReadonlyArray<LayerFilter>;
  readonly renamed: ReadonlyArray<{ original: string; final: string }>;
  readonly rejected: ReadonlyArray<{ index: number; error: string }>;
}

/**
 * Parse + validate JSON, dedupe names against `existing`. Returns the new
 * filters ready to be inserted (each with a unique name) and the rename log.
 *
 * The input may be:
 *   - An envelope `{ version, projectName, exportedAt, filters: [...] }`.
 *   - A raw array `[...]` (legacy / hand-crafted).
 */
export function importFiltersFromJson(input: {
  text: string;
  existing: ReadonlyArray<LayerFilter>;
}): ImportResult {
  const parsed = safeParseJson(input.text);
  if (parsed === null) {
    return { imported: [], renamed: [], rejected: [{ index: -1, error: 'invalid JSON' }] };
  }

  const candidatesRaw: unknown[] = extractFilterArray(parsed);
  const { valid, invalid } = validateLayerFilterJsonBulk(candidatesRaw);

  const existingNames = new Set(input.existing.map((f) => f.name));
  const imported: LayerFilter[] = [];
  const renamed: { original: string; final: string }[] = [];

  for (const filter of valid) {
    if (filter.source === 'system-smart') {
      // Smart filters cannot be imported — they are derived. Skip silently.
      continue;
    }
    const finalName = dedupeName(filter.name, existingNames);
    if (finalName !== filter.name) {
      renamed.push({ original: filter.name, final: finalName });
    }
    existingNames.add(finalName);
    imported.push({ ...filter, name: finalName, source: 'imported' });
  }

  return { imported, renamed, rejected: invalid };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractFilterArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (
    typeof value === 'object' && value !== null &&
    Array.isArray((value as { filters?: unknown[] }).filters)
  ) {
    return (value as { filters: unknown[] }).filters;
  }
  return [];
}

function dedupeName(name: string, existing: ReadonlySet<string>): string {
  if (!existing.has(name)) return name;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${name} (${i})`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${name} (${Date.now()})`;
}
