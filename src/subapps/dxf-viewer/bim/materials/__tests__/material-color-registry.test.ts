/**
 * ADR-679 Φ2a — material-color-registry: ενοποιημένη επίλυση χρώματος-ανά-id για ΟΛΟΥΣ
 * τους καταλόγους όψης + extensible provider registration.
 */

import {
  getMaterialColorById,
  registerMaterialColorProvider,
  __resetMaterialColorProvidersForTests,
} from '../material-color-registry';

describe('getMaterialColorById — static catalog providers', () => {
  afterEach(() => __resetMaterialColorProvidersForTests());

  it('resolves a wall-covering id (ADR-511)', () => {
    expect(getMaterialColorById('paint-red')).toBe('#C0392B');
  });

  it('resolves a floor-finish id (ADR-419 — όχι μόνο wall-covering)', () => {
    expect(getMaterialColorById('floor-wood-oak')).toBe('#C8A97E');
  });

  it('returns null for an id no catalog owns (→ base look)', () => {
    expect(getMaterialColorById('bmat_unknown')).toBeNull();
    expect(getMaterialColorById('totally-made-up')).toBeNull();
  });
});

describe('registerMaterialColorProvider — extensibility', () => {
  afterEach(() => __resetMaterialColorProvidersForTests());

  it('a registered provider resolves ITS ids without shadowing the static ones', () => {
    registerMaterialColorProvider((id) => (id === 'bmat_oak01' ? '#8B5E3C' : null));
    expect(getMaterialColorById('bmat_oak01')).toBe('#8B5E3C'); // library provider
    expect(getMaterialColorById('paint-red')).toBe('#C0392B'); // static still works
    expect(getMaterialColorById('bmat_other')).toBeNull(); // provider returns null → miss
  });

  it('the first non-null provider wins (registration order)', () => {
    registerMaterialColorProvider(() => '#111111');
    // Static wall-covering provider is registered FIRST → wins over the greedy late one.
    expect(getMaterialColorById('paint-red')).toBe('#C0392B');
    // An id no static provider owns falls through to the greedy provider.
    expect(getMaterialColorById('anything-else')).toBe('#111111');
  });

  it('reset restores only the static providers', () => {
    registerMaterialColorProvider((id) => (id === 'bmat_x' ? '#FFFFFF' : null));
    expect(getMaterialColorById('bmat_x')).toBe('#FFFFFF');
    __resetMaterialColorProvidersForTests();
    expect(getMaterialColorById('bmat_x')).toBeNull();
  });
});
