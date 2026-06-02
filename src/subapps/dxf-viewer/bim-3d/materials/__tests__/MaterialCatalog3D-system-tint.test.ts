/**
 * ADR-408 Φ5 — colour-by-system tinted material tests.
 *
 * Guards the cardinal rule: the tinted material must NOT mutate the shared
 * element singleton, must cache per colour, and must keep the element's base
 * PBR (roughness/metalness/transparency) while overriding only the colour.
 */

import {
  getElementMaterial3D,
  getSystemTintedMaterial3D,
} from '../MaterialCatalog3D';

describe('getSystemTintedMaterial3D', () => {
  it('does not mutate the shared element singleton', () => {
    const base = getElementMaterial3D('mep-fixture');
    const baseColor = base.color.getHex();
    const tinted = getSystemTintedMaterial3D('mep-fixture', 0x2563eb);
    expect(tinted).not.toBe(base);
    expect(base.color.getHex()).toBe(baseColor); // singleton untouched
    expect(tinted.color.getHex()).toBe(0x2563eb);
  });

  it('caches per (type, colour) and inherits the base PBR', () => {
    const a = getSystemTintedMaterial3D('electrical-panel', 0xdc2626);
    const b = getSystemTintedMaterial3D('electrical-panel', 0xdc2626);
    expect(a).toBe(b); // same colour → cached instance

    const c = getSystemTintedMaterial3D('electrical-panel', 0x16a34a);
    expect(c).not.toBe(a); // different colour → distinct instance

    const base = getElementMaterial3D('electrical-panel');
    expect(a.roughness).toBe(base.roughness);
    expect(a.metalness).toBe(base.metalness);
  });
});
