/**
 * ADR-358 Q19 Φ7 — per-riser material override resolution.
 *
 * Guards the Φ7 addition to `resolveStairMaterial`: a riser now resolves through
 * `perRiserOverrides[subIndex].material` (mirror of the per-tread chain) before
 * the stair-level `materials.riser` default. Uses reference equality against the
 * cached MaterialCatalog3D entries (same key → same object, until dispose).
 */

import { resolveStairMaterial } from '../stair-material-resolver';
import { getMaterial3D, getElementMaterial3D } from '../MaterialCatalog3D';
import type { StairEntity, StairParams } from '../../../bim/types/stair-types';

function stair(params: Partial<StairParams>): StairEntity {
  return { id: 'stair_1', type: 'stair', params } as unknown as StairEntity;
}

describe('resolveStairMaterial — per-riser override (Φ7)', () => {
  it('resolves a per-riser override (0-based) to its material', () => {
    const s = stair({ perRiserOverrides: { 0: { material: 'oak' } } });
    expect(resolveStairMaterial(s, 'stair-riser', 0)).toBe(getMaterial3D('mat-wood'));
  });

  it('maps another preset (steel → metal) for a higher riser index', () => {
    const s = stair({ perRiserOverrides: { 2: { material: 'steel' } } });
    expect(resolveStairMaterial(s, 'stair-riser', 2)).toBe(getMaterial3D('mat-metal'));
  });

  it('falls back to the stair-level riser material when no override on that index', () => {
    const s = stair({ perRiserOverrides: { 1: { material: 'oak' } }, materials: { riser: 'marble' } });
    expect(resolveStairMaterial(s, 'stair-riser', 0)).toBe(getMaterial3D('mat-stone'));
  });

  it('falls back to the element default when neither override nor stair-level material', () => {
    const s = stair({});
    expect(resolveStairMaterial(s, 'stair-riser', 0)).toBe(getElementMaterial3D('stair-riser'));
  });

  it('does NOT leak a per-TREAD override into a riser at the same index', () => {
    const s = stair({ perTreadOverrides: { 0: { material: 'oak' } } });
    expect(resolveStairMaterial(s, 'stair-riser', 0)).toBe(getElementMaterial3D('stair-riser'));
  });

  it('does NOT leak a per-RISER override into a tread at the same index', () => {
    const s = stair({ perRiserOverrides: { 0: { material: 'steel' } } });
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(getElementMaterial3D('stair-tread'));
  });

  it('ignores overrides when subIndex is undefined', () => {
    const s = stair({ perRiserOverrides: { 0: { material: 'oak' } } });
    expect(resolveStairMaterial(s, 'stair-riser')).toBe(getElementMaterial3D('stair-riser'));
  });
});
