/**
 * stair-structure-material-defaults — coherent per-structure material set
 * (Revit: the material set follows the stair TYPE). Verifies the SSoT map that
 * replaced the arbitrary fixed mix (wood tread + concrete landing regardless of
 * structure) which rendered a monolithic RC stair with incongruous timber treads
 * (Giorgio 2026-07-21).
 *
 * @see ../stair-structure-material-defaults.ts
 */

import { resolveStructureComponentMaterialKey } from '../stair-structure-material-defaults';
import type { StairStructureType } from '../../../bim/types/stair-types';
import type { Stair3DComponent } from '../MaterialCatalog3D';

const WALK: readonly Stair3DComponent[] = ['stair-tread', 'stair-riser', 'stair-landing'];

describe('resolveStructureComponentMaterialKey', () => {
  it('monolithic → the whole walk surface (tread/riser/landing) is ONE concrete', () => {
    for (const c of WALK) {
      expect(resolveStructureComponentMaterialKey('monolithic', c)).toBe('mat-concrete');
    }
  });

  it('monolithic tread is concrete, NOT the legacy arbitrary wood', () => {
    expect(resolveStructureComponentMaterialKey('monolithic', 'stair-tread')).toBe('mat-concrete');
  });

  it('stringer families → timber walk surface + metal stringer (coherent type)', () => {
    const types: readonly StairStructureType[] = ['stringer-1side', 'stringer-2side', 'central-stringer', 'suspended'];
    for (const t of types) {
      for (const c of WALK) expect(resolveStructureComponentMaterialKey(t, c)).toBe('mat-wood');
      expect(resolveStructureComponentMaterialKey(t, 'stair-stringer')).toBe('mat-metal');
    }
  });

  it('glass-tread → glass walk surface; steel-grating → metal throughout', () => {
    expect(resolveStructureComponentMaterialKey('glass-tread', 'stair-tread')).toBe('mat-glass');
    expect(resolveStructureComponentMaterialKey('steel-grating', 'stair-tread')).toBe('mat-metal');
    expect(resolveStructureComponentMaterialKey('steel-grating', 'stair-landing')).toBe('mat-metal');
  });

  it('handrail is metal across every structure (the support family)', () => {
    const all: readonly StairStructureType[] = [
      'monolithic', 'cantilever', 'suspended', 'stringer-1side',
      'stringer-2side', 'central-stringer', 'glass-tread', 'steel-grating',
    ];
    for (const t of all) expect(resolveStructureComponentMaterialKey(t, 'stair-handrail')).toBe('mat-metal');
  });

  it('every StairStructureType has a coherent set (no unmapped structure → element fallback surprise)', () => {
    const all: readonly StairStructureType[] = [
      'monolithic', 'cantilever', 'suspended', 'stringer-1side',
      'stringer-2side', 'central-stringer', 'glass-tread', 'steel-grating',
    ];
    for (const t of all) {
      expect(resolveStructureComponentMaterialKey(t, 'stair-tread')).toBeDefined();
    }
  });
});
