/**
 * layer-filter-io tests — ADR-358 §5.7.bis Q11 Phase 11.
 *
 * Covers: export envelope, filename pattern with HH-mm timestamp, import
 * dedupe by name with `(N)` suffix, malformed JSON rejection, smart-filter
 * skip on import.
 */

import { describe, it, expect } from '@jest/globals';
import {
  LAYER_FILTERS_EXPORT_VERSION,
  buildExportFilename,
  exportFiltersAsJson,
  importFiltersFromJson,
} from '../layer-filter-io';
import type { LayerFilter } from '../../types/layer-filters';

function group(id: string, name: string): LayerFilter {
  return { kind: 'group', id, name, source: 'user-created', createdAt: 't', layerIds: [] };
}

describe('export', () => {
  it('envelope contains version + projectName + filters', () => {
    const { json } = exportFiltersAsJson({ filters: [group('lfg_a', 'A')], projectName: 'demo' });
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(LAYER_FILTERS_EXPORT_VERSION);
    expect(parsed.projectName).toBe('demo');
    expect(parsed.filters).toHaveLength(1);
    expect(parsed.filters[0].id).toBe('lfg_a');
  });

  it('strips smart filters defensively', () => {
    const smart: LayerFilter = {
      kind: 'properties', id: 'lfs_visible', name: 'v', source: 'system-smart', createdAt: 't',
      rules: { combinator: 'AND', rules: [] },
    };
    const { json } = exportFiltersAsJson({ filters: [smart, group('lfg_a', 'A')], projectName: 'demo' });
    const parsed = JSON.parse(json);
    expect(parsed.filters).toHaveLength(1);
    expect(parsed.filters[0].id).toBe('lfg_a');
  });

  it('filename pattern includes HH-mm timestamp', () => {
    const now = new Date(2026, 4, 17, 9, 7); // 09:07 May 17 2026
    const name = buildExportFilename('Demo Project', now);
    expect(name).toBe('Demo_Project-layer-filters-2026-05-17-0907.json');
  });

  it('filename sanitizes unsafe chars', () => {
    const now = new Date(2026, 0, 1, 0, 0);
    expect(buildExportFilename('A/B*C?', now)).toContain('A_B_C_-layer-filters-');
  });
});

describe('import', () => {
  it('rejects invalid JSON', () => {
    const result = importFiltersFromJson({ text: 'not json{', existing: [] });
    expect(result.rejected).toHaveLength(1);
    expect(result.imported).toHaveLength(0);
  });

  it('accepts envelope shape', () => {
    const envelope = {
      version: 1, projectName: 'demo', exportedAt: 't',
      filters: [group('lfg_a', 'A')],
    };
    const result = importFiltersFromJson({ text: JSON.stringify(envelope), existing: [] });
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].source).toBe('imported');
  });

  it('accepts raw array (legacy)', () => {
    const result = importFiltersFromJson({ text: JSON.stringify([group('lfg_a', 'A')]), existing: [] });
    expect(result.imported).toHaveLength(1);
  });

  it('dedupes by name with (2) suffix', () => {
    const result = importFiltersFromJson({
      text: JSON.stringify([group('lfg_a', 'Walls'), group('lfg_b', 'Walls')]),
      existing: [group('lfg_existing', 'Walls')],
    });
    expect(result.imported.map((f) => f.name)).toEqual(['Walls (2)', 'Walls (3)']);
    expect(result.renamed).toHaveLength(2);
  });

  it('skips smart filters silently', () => {
    const smart = {
      kind: 'properties', id: 'lfs_visible', name: 'v', source: 'system-smart',
      createdAt: 't', rules: { combinator: 'AND', rules: [] },
    };
    const result = importFiltersFromJson({ text: JSON.stringify([smart, group('lfg_a', 'A')]), existing: [] });
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].id).toBe('lfg_a');
  });

  it('rejects malformed entries individually', () => {
    const result = importFiltersFromJson({
      text: JSON.stringify([{ kind: 'group' /* missing id/name */ }, group('lfg_ok', 'Ok')]),
      existing: [],
    });
    expect(result.imported.map((f) => f.id)).toEqual(['lfg_ok']);
    expect(result.rejected).toHaveLength(1);
  });
});
