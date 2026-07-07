/**
 * ADR-581 — Semantic mapping resolver tests.
 */

import { resolveSemanticMapping } from '../semantic-mapping-resolver';
import { __clearMatchRegistryCache } from '../match-registry';

beforeEach(() => __clearMatchRegistryCache());

describe('resolveSemanticMapping', () => {
  it('same-type → identity mapping (confidence 1, sourceKey === targetKey)', () => {
    const m = resolveSemanticMapping('column', 'column');
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => x.confidence === 1 && x.sourceKey === x.targetKey)).toBe(true);
    expect(m.some((x) => x.role === 'style.color')).toBe(true);
  });

  it('column → beam: width/depth αντιστοιχούν @0.9, height ΑΠΟΡΡΙΠΤΕΤΑΙ', () => {
    const m = resolveSemanticMapping('column', 'beam');
    const width = m.find((x) => x.sourceKey === 'params.width');
    const depth = m.find((x) => x.sourceKey === 'params.depth');
    const height = m.find((x) => x.sourceKey === 'params.height');
    expect(width?.targetKey).toBe('params.width');
    expect(width?.confidence).toBeCloseTo(0.9);
    expect(depth?.targetKey).toBe('params.depth');
    expect(height).toBeUndefined();
  });

  it('column → beam: material.primary αντιστοιχεί @0.9', () => {
    const mat = resolveSemanticMapping('column', 'beam').find((x) => x.role === 'material.primary');
    expect(mat?.targetKey).toBe('params.material');
    expect(mat?.confidence).toBeCloseTo(0.9);
  });

  it('DXF line → wall: μόνο style roles (κανένα params)', () => {
    const m = resolveSemanticMapping('line', 'wall');
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => x.sourceKey.startsWith('scene.'))).toBe(true);
    expect(m.some((x) => x.role === 'style.color')).toBe(true);
  });
});
