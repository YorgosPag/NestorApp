/**
 * ADR-408 Δρόμος B — plumbing-fixture-spec unifying dispatch (sanitary ∪ appliance).
 *
 * Verifies the family-blind guards + dispatchers route to the correct registry: a
 * sanitary kind resolves the sanitary spec/drawer/mesh, an appliance kind the
 * appliance ones, and a non-plumbing kind yields no mesh presets.
 */

import {
  isPlumbingFixtureKind,
  resolvePlumbingFixtureSpec,
  resolvePlumbingFixtureDrawer,
  plumbingFixtureToolKind,
  fixtureMeshPresetsForKind,
  resolveFixtureMeshPreset,
} from '../plumbing-fixture-spec';
import { SANITARY_SPEC, SANITARY_DRAWERS } from '../../sanitary/sanitary-symbol-spec';
import { APPLIANCE_SPEC, APPLIANCE_DRAWERS } from '../../appliances/appliance-symbol-spec';

describe('plumbing-fixture-spec', () => {
  it('isPlumbingFixtureKind = sanitary ∪ appliance', () => {
    expect(isPlumbingFixtureKind('wc')).toBe(true);
    expect(isPlumbingFixtureKind('washing-machine')).toBe(true);
    expect(isPlumbingFixtureKind('light-fixture')).toBe(false);
    expect(isPlumbingFixtureKind('floor-drain')).toBe(false);
  });

  it('resolvePlumbingFixtureSpec dispatches to the right family registry', () => {
    expect(resolvePlumbingFixtureSpec('wc')).toBe(SANITARY_SPEC['wc']);
    expect(resolvePlumbingFixtureSpec('washing-machine')).toBe(APPLIANCE_SPEC['washing-machine']);
  });

  it('resolvePlumbingFixtureDrawer dispatches to the right family registry', () => {
    expect(resolvePlumbingFixtureDrawer('shower')).toBe(SANITARY_DRAWERS['shower']);
    expect(resolvePlumbingFixtureDrawer('washing-machine')).toBe(APPLIANCE_DRAWERS['washing-machine']);
  });

  it('plumbingFixtureToolKind resolves both families (or null)', () => {
    expect(plumbingFixtureToolKind('mep-wc')).toBe('wc');
    expect(plumbingFixtureToolKind('mep-washing-machine')).toBe('washing-machine');
    expect(plumbingFixtureToolKind('mep-fixture')).toBeNull();
  });

  it('fixtureMeshPresetsForKind returns only same-kind presets, [] for non-plumbing', () => {
    const appliance = fixtureMeshPresetsForKind('washing-machine');
    expect(appliance.length).toBeGreaterThan(0);
    expect(appliance.every((p) => p.kind === 'washing-machine')).toBe(true);
    expect(fixtureMeshPresetsForKind('light-fixture')).toEqual([]);
    expect(fixtureMeshPresetsForKind('floor-drain')).toEqual([]);
  });

  it('resolveFixtureMeshPreset finds presets across both catalogs', () => {
    expect(resolveFixtureMeshPreset('washing_machine_01')?.kind).toBe('washing-machine');
    expect(resolveFixtureMeshPreset('shower_realistic_01')?.kind).toBe('shower');
    expect(resolveFixtureMeshPreset('does-not-exist')).toBeUndefined();
  });
});
