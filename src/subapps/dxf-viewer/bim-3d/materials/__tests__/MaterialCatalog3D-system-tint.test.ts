/**
 * ADR-408 Φ5 — colour-by-system tinted material tests.
 *
 * Guards the cardinal rule: the tinted material must NOT mutate the shared
 * element singleton, must cache per colour, and (Revit "Color by system") must
 * render as a FLAT schematic surface — the colour clamped toward diffuse (low
 * metalness, higher roughness) so it reads uniformly across every orientation.
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

  it('caches per (type, colour)', () => {
    const a = getSystemTintedMaterial3D('electrical-panel', 0xdc2626);
    const b = getSystemTintedMaterial3D('electrical-panel', 0xdc2626);
    expect(a).toBe(b); // same colour → cached instance

    const c = getSystemTintedMaterial3D('electrical-panel', 0x16a34a);
    expect(c).not.toBe(a); // different colour → distinct instance
  });

  it('clamps a metallic base toward a flat diffuse surface (uniform colour)', () => {
    // elem-mep-pipe base is shiny metal (roughness 0.30, metalness 0.75); the tint
    // must flatten it so a straight pipe + a curved elbow read the SAME shade.
    const tinted = getSystemTintedMaterial3D('mep-pipe', 0x2563eb);
    expect(tinted.roughness).toBe(0.6); // floored up from 0.30
    expect(tinted.metalness).toBe(0.1); // capped down from 0.75
    expect(tinted.color.getHex()).toBe(0x2563eb);
  });

  it('keeps an already-diffuse base translucent (luminaire) while flattening it', () => {
    // elem-mep-fixture is translucent (opacity 0.85); the tint must preserve that.
    const tinted = getSystemTintedMaterial3D('mep-fixture', 0x2563eb);
    expect(tinted.transparent).toBe(true);
    expect(tinted.opacity).toBeCloseTo(0.85);
    expect(tinted.metalness).toBeLessThanOrEqual(0.1);
  });
});
