/**
 * resolve-entity-bim-category tests — ADR-358 §5.6.bis.
 *
 * Covers the entity → BimCategory SSoT resolver and the collectBimCategories
 * selection helper used by "Isolate Category".
 */

import { describe, it, expect } from '@jest/globals';
import { resolveEntityBimCategory, collectBimCategories } from '../resolve-entity-bim-category';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const asEntity = (e: Partial<DxfEntityUnion> & { type: string }) => e as unknown as DxfEntityUnion;

describe('resolveEntityBimCategory', () => {
  it('maps direct-category BIM types (entity.type === BimCategory)', () => {
    expect(resolveEntityBimCategory(asEntity({ type: 'wall' }))).toBe('wall');
    expect(resolveEntityBimCategory(asEntity({ type: 'column' }))).toBe('column');
    expect(resolveEntityBimCategory(asEntity({ type: 'foundation' }))).toBe('foundation');
    expect(resolveEntityBimCategory(asEntity({ type: 'slab' }))).toBe('slab');
  });

  it('returns null for raw DXF primitives (no BimCategory)', () => {
    expect(resolveEntityBimCategory(asEntity({ type: 'line' }))).toBeNull();
    expect(resolveEntityBimCategory(asEntity({ type: 'arc' }))).toBeNull();
    expect(resolveEntityBimCategory(asEntity({ type: 'circle' }))).toBeNull();
    expect(resolveEntityBimCategory(asEntity({ type: 'text' }))).toBeNull();
  });

  it('returns null for imported-mesh (composite, no V/G Object Style)', () => {
    // Regression: imported-mesh is NOT a BimCategory / has no DEFAULT_OBJECT_STYLES
    // entry. Previously it was in DIRECT_CATEGORY_TYPES and cast to BimCategory,
    // making styles['imported-mesh'] undefined → crash in resolveSubcategoryStyle
    // (`parent.visible`) during the column batch-fill same-colour scan.
    expect(resolveEntityBimCategory(asEntity({ type: 'imported-mesh' }))).toBeNull();
  });
});

describe('collectBimCategories', () => {
  const entities = [
    asEntity({ type: 'wall', id: 'w1' }),
    asEntity({ type: 'wall', id: 'w2' }),
    asEntity({ type: 'column', id: 'c1' }),
    asEntity({ type: 'line', id: 'l1' }),
  ];

  it('collects distinct categories of the selected ids', () => {
    expect(collectBimCategories(['w1', 'w2'], entities)).toEqual(['wall']);
    expect(collectBimCategories(['w1', 'c1'], entities).sort()).toEqual(['column', 'wall']);
  });

  it('ignores raw DXF entities (no category)', () => {
    expect(collectBimCategories(['l1'], entities)).toEqual([]);
    expect(collectBimCategories(['w1', 'l1'], entities)).toEqual(['wall']);
  });

  it('returns empty for empty selection or missing scene', () => {
    expect(collectBimCategories([], entities)).toEqual([]);
    expect(collectBimCategories(['w1'], undefined)).toEqual([]);
  });
});
