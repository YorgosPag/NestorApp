/**
 * RibbonFieldStore — per-key reference-stability + isolation invariants
 * (ADR-547 Stage 4 Option B). These guarantee `useSyncExternalStore` does NOT
 * loop (snapshot cached) and that a change to one key re-renders only that key's
 * widget.
 */
import {
  setRibbonFieldReaders,
  resetRibbonFieldReaders,
  subscribeRibbonField,
  getRibbonComboboxSlice,
  getRibbonToggleSlice,
  getRibbonBadgeSlice,
  getRibbonPanelVisibilitySlice,
  type RibbonFieldReaders,
} from '../RibbonFieldStore';
import type { RibbonComboboxState } from '../ribbon-command-types';

function makeReaders(
  combo: Record<string, RibbonComboboxState | null>,
  toggles: Record<string, boolean | null> = {},
  badges: Record<string, boolean> = {},
  vis: Record<string, boolean> = {},
): RibbonFieldReaders {
  return {
    getComboboxState: (k) => combo[k] ?? null,
    getToggleState: (k) => toggles[k] ?? false,
    getBadgeState: (k) => badges[k] ?? false,
    getPanelVisibility: (k) => vis[k] ?? true,
  };
}

const opt = (v: string) => ({ value: v, labelKey: v, isLiteralLabel: true as const });

afterEach(() => resetRibbonFieldReaders());

describe('RibbonFieldStore — combobox slice stability', () => {
  it('returns a STABLE reference while the signature is unchanged', () => {
    setRibbonFieldReaders(
      makeReaders({ 'wall.thickness': { value: '200', options: [opt('100'), opt('200')] } }),
    );
    const a = getRibbonComboboxSlice('wall.thickness');
    const b = getRibbonComboboxSlice('wall.thickness');
    expect(a).toBe(b); // same ref → useSyncExternalStore will NOT loop / re-render
  });

  it('returns a NEW reference when the value changes', () => {
    setRibbonFieldReaders(
      makeReaders({ 'wall.thickness': { value: '200', options: [opt('100'), opt('200')] } }),
    );
    const before = getRibbonComboboxSlice('wall.thickness');
    setRibbonFieldReaders(
      makeReaders({ 'wall.thickness': { value: '100', options: [opt('100'), opt('200')] } }),
    );
    const after = getRibbonComboboxSlice('wall.thickness');
    expect(after).not.toBe(before);
    expect(after?.value).toBe('100');
  });

  it('returns a NEW reference when the option list changes', () => {
    setRibbonFieldReaders(makeReaders({ 'wall.material': { value: 'a', options: [opt('a')] } }));
    const before = getRibbonComboboxSlice('wall.material');
    setRibbonFieldReaders(makeReaders({ 'wall.material': { value: 'a', options: [opt('a'), opt('b')] } }));
    expect(getRibbonComboboxSlice('wall.material')).not.toBe(before);
  });

  it('KEY ISOLATION: editing key A keeps key B reference-stable', () => {
    setRibbonFieldReaders(
      makeReaders({
        'wall.thickness': { value: '200', options: [opt('200')] },
        'wall.material': { value: 'brick', options: [opt('brick')] },
      }),
    );
    const materialBefore = getRibbonComboboxSlice('wall.material');
    // change ONLY thickness
    setRibbonFieldReaders(
      makeReaders({
        'wall.thickness': { value: '300', options: [opt('300')] },
        'wall.material': { value: 'brick', options: [opt('brick')] },
      }),
    );
    expect(getRibbonComboboxSlice('wall.thickness')?.value).toBe('300');
    expect(getRibbonComboboxSlice('wall.material')).toBe(materialBefore); // untouched → SAME ref
  });

  it('tracks the `disabled` flag in the signature', () => {
    setRibbonFieldReaders(makeReaders({ k: { value: 'x', options: [opt('x')], disabled: false } }));
    const before = getRibbonComboboxSlice('k');
    setRibbonFieldReaders(makeReaders({ k: { value: 'x', options: [opt('x')], disabled: true } }));
    expect(getRibbonComboboxSlice('k')).not.toBe(before);
  });
});

describe('RibbonFieldStore — primitive slices + subscription', () => {
  it('toggle / badge / visibility return primitives', () => {
    setRibbonFieldReaders(makeReaders({}, { t: true }, { b: true }, { v: false }));
    expect(getRibbonToggleSlice('t')).toBe(true);
    expect(getRibbonBadgeSlice('b')).toBe(true);
    expect(getRibbonPanelVisibilitySlice('v')).toBe(false);
  });

  it('defaults: toggle=false, badge=false, visibility=true for unknown keys', () => {
    setRibbonFieldReaders(makeReaders({}));
    expect(getRibbonToggleSlice('nope')).toBe(false);
    expect(getRibbonBadgeSlice('nope')).toBe(false);
    expect(getRibbonPanelVisibilitySlice('nope')).toBe(true);
  });

  it('notifies subscribers on setReaders and stops after unsubscribe', () => {
    let hits = 0;
    const unsub = subscribeRibbonField(() => { hits += 1; });
    setRibbonFieldReaders(makeReaders({}));
    setRibbonFieldReaders(makeReaders({}));
    expect(hits).toBe(2);
    unsub();
    setRibbonFieldReaders(makeReaders({}));
    expect(hits).toBe(2);
  });

  it('reset clears the combobox cache + readers', () => {
    setRibbonFieldReaders(makeReaders({ k: { value: 'x', options: [opt('x')] } }));
    expect(getRibbonComboboxSlice('k')?.value).toBe('x');
    resetRibbonFieldReaders();
    expect(getRibbonComboboxSlice('k')).toBeNull();
  });
});
