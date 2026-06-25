// ============================================================================
// SELECTED ENTITIES STORE — unit tests (ADR-532)
// Parity with the old UNIVERSAL_* reducer cases + reference-stable snapshots.
// ============================================================================

import { SelectedEntitiesStore } from '../SelectedEntitiesStore';

beforeEach(() => {
  SelectedEntitiesStore._resetForTests();
});

describe('SelectedEntitiesStore — mutators + primary', () => {
  it('selectEntity replaces everything and sets primary', () => {
    SelectedEntitiesStore.addEntity({ id: 'old', type: 'dxf-entity' });
    SelectedEntitiesStore.selectEntity({ id: 'a', type: 'dxf-entity' });

    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['a']);
    expect(SelectedEntitiesStore.getPrimaryId()).toBe('a');
    expect(SelectedEntitiesStore.isSelected('old')).toBe(false);
  });

  it('addEntity / addEntities accumulate, primary = last added', () => {
    SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' });
    SelectedEntitiesStore.addEntities([
      { id: 'b', type: 'dxf-entity' },
      { id: 'c', type: 'dxf-entity' },
    ]);
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['a', 'b', 'c']);
    expect(SelectedEntitiesStore.getPrimaryId()).toBe('c');
  });

  it('deselectEntity recomputes primary when the primary is removed', () => {
    SelectedEntitiesStore.addEntities([
      { id: 'a', type: 'dxf-entity' },
      { id: 'b', type: 'dxf-entity' },
    ]);
    expect(SelectedEntitiesStore.getPrimaryId()).toBe('b');
    SelectedEntitiesStore.deselectEntity('b');
    expect(SelectedEntitiesStore.getPrimaryId()).toBe('a');
    expect(SelectedEntitiesStore.isSelected('b')).toBe(false);
  });

  it('toggleEntity adds then removes', () => {
    SelectedEntitiesStore.toggleEntity({ id: 'a', type: 'dxf-entity' });
    expect(SelectedEntitiesStore.isSelected('a')).toBe(true);
    SelectedEntitiesStore.toggleEntity({ id: 'a', type: 'dxf-entity' });
    expect(SelectedEntitiesStore.isSelected('a')).toBe(false);
  });

  it('clearByType keeps other types and recomputes primary', () => {
    SelectedEntitiesStore.addEntity({ id: 'ov', type: 'overlay' });
    SelectedEntitiesStore.addEntity({ id: 'dx', type: 'dxf-entity' });
    SelectedEntitiesStore.clearByType('dxf-entity');
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual([]);
    expect(SelectedEntitiesStore.getIdsByType('overlay')).toEqual(['ov']);
    expect(SelectedEntitiesStore.getPrimaryId()).toBe('ov');
  });

  it('clearAll empties everything', () => {
    SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' });
    SelectedEntitiesStore.clearAll();
    expect(SelectedEntitiesStore.count()).toBe(0);
    expect(SelectedEntitiesStore.getPrimaryId()).toBeNull();
  });

  it("getIdsByType('overlay') includes region entries (alias)", () => {
    SelectedEntitiesStore.addEntity({ id: 'ov', type: 'overlay' });
    SelectedEntitiesStore.addEntity({ id: 'rg', type: 'region' });
    expect(SelectedEntitiesStore.getIdsByType('overlay').sort()).toEqual(['ov', 'rg']);
    expect(SelectedEntitiesStore.getOverlayRegionIds().sort()).toEqual(['ov', 'rg']);
  });
});

describe('SelectedEntitiesStore — legacy mirror descriptors', () => {
  it('dxf-entity select resets editing but does not change regionIds', () => {
    const m = SelectedEntitiesStore.selectEntity({ id: 'a', type: 'dxf-entity' });
    expect(m).toEqual({ regionIdsChanged: false, regionIds: [], resetEditing: true });
  });

  it('overlay select changes regionIds and resets editing', () => {
    const m = SelectedEntitiesStore.selectEntity({ id: 'ov', type: 'overlay' });
    expect(m.regionIdsChanged).toBe(true);
    expect(m.regionIds).toEqual(['ov']);
    expect(m.resetEditing).toBe(true);
  });

  it('dxf-entity add produces no legacy mirror', () => {
    const m = SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' });
    expect(m).toEqual({ regionIdsChanged: false, regionIds: [], resetEditing: false });
  });

  it('clearAll always signals a region reset', () => {
    const m = SelectedEntitiesStore.clearAll();
    expect(m).toEqual({ regionIdsChanged: true, regionIds: [], resetEditing: true });
  });
});

describe('SelectedEntitiesStore — snapshot stability (useSyncExternalStore contract)', () => {
  it('getSelectedEntityIds returns the SAME reference across reads with no mutation', () => {
    SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' });
    const r1 = SelectedEntitiesStore.getSelectedEntityIds();
    const r2 = SelectedEntitiesStore.getSelectedEntityIds();
    expect(r1).toBe(r2);
  });

  it('getSelectedEntityIds returns a NEW reference after a mutation', () => {
    SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' });
    const r1 = SelectedEntitiesStore.getSelectedEntityIds();
    SelectedEntitiesStore.addEntity({ id: 'b', type: 'dxf-entity' });
    const r2 = SelectedEntitiesStore.getSelectedEntityIds();
    expect(r1).not.toBe(r2);
    expect(r2).toEqual(['a', 'b']);
  });

  it('empty reads share one stable EMPTY reference', () => {
    const r1 = SelectedEntitiesStore.getSelectedEntityIds();
    const r2 = SelectedEntitiesStore.getIdsByType('overlay');
    expect(r1).toBe(r2); // same frozen EMPTY
  });
});

describe('SelectedEntitiesStore — replaceEntitySelection (atomic + skip-if-unchanged)', () => {
  it('replaces dxf-entity selection while keeping overlays', () => {
    SelectedEntitiesStore.addEntity({ id: 'ov', type: 'overlay' });
    SelectedEntitiesStore.addEntity({ id: 'x', type: 'dxf-entity' });
    SelectedEntitiesStore.replaceEntitySelection(['y', 'z']);
    expect(SelectedEntitiesStore.getSelectedEntityIds().sort()).toEqual(['y', 'z']);
    expect(SelectedEntitiesStore.isSelected('ov')).toBe(true);
    expect(SelectedEntitiesStore.isSelected('x')).toBe(false);
  });

  it('does NOT notify or bump version when the dxf set is identical', () => {
    SelectedEntitiesStore.replaceEntitySelection(['a']);
    const v1 = SelectedEntitiesStore.getVersion();
    const fired: number[] = [];
    const unsub = SelectedEntitiesStore.subscribe(() => fired.push(1));
    SelectedEntitiesStore.replaceEntitySelection(['a']);
    unsub();
    expect(SelectedEntitiesStore.getVersion()).toBe(v1);
    expect(fired).toHaveLength(0);
  });
});

describe('SelectedEntitiesStore — subscription', () => {
  it('notifies subscribers and bumps version on mutation', () => {
    let calls = 0;
    const unsub = SelectedEntitiesStore.subscribe(() => { calls += 1; });
    const v0 = SelectedEntitiesStore.getVersion();
    SelectedEntitiesStore.addEntity({ id: 'a', type: 'dxf-entity' });
    expect(calls).toBe(1);
    expect(SelectedEntitiesStore.getVersion()).toBe(v0 + 1);
    unsub();
    SelectedEntitiesStore.addEntity({ id: 'b', type: 'dxf-entity' });
    expect(calls).toBe(1); // no longer subscribed
  });
});
