/**
 * ADR-539 Φ7 — per-sub-element FULL appearance resolution (Polygon «Paint» parity με solids).
 *
 * Guards το step-0 του `resolveStairMaterial`: ένα `appearance` override (materialId textured /
 * colorHex) ΚΕΡΔΙΖΕΙ του legacy `material` preset, resolved μέσω του ΙΔΙΟΥ SSoT με το per-face
 * solid resolve (`getFaceColorMaterial3D`/`getFaceMaterial3D` + `faceAppearanceColorHex`). Reference
 * equality έναντι των cached MaterialCatalog3D entries (ίδιο input → ίδιο object, μέχρι dispose).
 */

import { resolveStairMaterial, resolveStairAppearanceMaterial } from '../stair-material-resolver';
import { getMaterial3D, getFaceColorMaterial3D } from '../MaterialCatalog3D';
import type { StairEntity, StairParams } from '../../../bim/types/stair-types';

function stair(params: Partial<StairParams>): StairEntity {
  return { id: 'stair_1', type: 'stair', params } as unknown as StairEntity;
}

describe('resolveStairMaterial — per-sub-element appearance (Φ7)', () => {
  it('resolveStairAppearanceMaterial(undefined) → null', () => {
    expect(resolveStairAppearanceMaterial(undefined)).toBeNull();
  });

  it('resolveStairAppearanceMaterial({}) → null (καμία πηγή χρώματος)', () => {
    expect(resolveStairAppearanceMaterial({})).toBeNull();
  });

  it('colorHex appearance → flat colour material (ίδιο SSoT με per-face solid)', () => {
    const s = stair({ perTreadOverrides: { 0: { appearance: { colorHex: '#C0392B' } } } });
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(getFaceColorMaterial3D('#C0392B'));
  });

  it('appearance ΚΕΡΔΙΖΕΙ του legacy `material` preset στο ίδιο tread', () => {
    const s = stair({ perTreadOverrides: { 0: { material: 'oak', appearance: { colorHex: '#123456' } } } });
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(getFaceColorMaterial3D('#123456'));
  });

  it('riser appearance (colorHex) resolves per-index', () => {
    const s = stair({ perRiserOverrides: { 2: { appearance: { colorHex: '#00ff00' } } } });
    expect(resolveStairMaterial(s, 'stair-riser', 2)).toBe(getFaceColorMaterial3D('#00ff00'));
  });

  it('landing appearance (colorHex) resolves via perLandingOverrides', () => {
    const s = stair({ perLandingOverrides: { 1: { appearance: { colorHex: '#0000ff' } } } });
    expect(resolveStairMaterial(s, 'stair-landing', 1)).toBe(getFaceColorMaterial3D('#0000ff'));
  });

  it('appearance χωρίς πηγή χρώματος → πέφτει στο legacy preset material', () => {
    const s = stair({ perTreadOverrides: { 0: { material: 'oak', appearance: {} } } });
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(getMaterial3D('mat-wood'));
  });

  it('δεν διαρρέει appearance άλλου index', () => {
    const s = stair({ perTreadOverrides: { 0: { appearance: { colorHex: '#C0392B' } } } });
    // index 1 δεν έχει appearance/material → element default (όχι το χρώμα του 0).
    expect(resolveStairMaterial(s, 'stair-tread', 1)).not.toBe(getFaceColorMaterial3D('#C0392B'));
  });
});

describe('resolveStairMaterial — whole-stair appearance (Φ7, ΣΩΜΑ)', () => {
  it('materials.appearance βάφει ΟΛΑ τα components (tread/riser/stringer/landing)', () => {
    const s = stair({ materials: { appearance: { colorHex: '#654321' } } });
    const red = getFaceColorMaterial3D('#654321');
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(red);
    expect(resolveStairMaterial(s, 'stair-riser', 0)).toBe(red);
    expect(resolveStairMaterial(s, 'stair-stringer')).toBe(red);
    expect(resolveStairMaterial(s, 'stair-landing', 0)).toBe(red);
  });

  it('per-sub-element appearance ΚΕΡΔΙΖΕΙ της whole-stair appearance στο ίδιο tread', () => {
    const s = stair({
      materials: { appearance: { colorHex: '#654321' } },
      perTreadOverrides: { 2: { appearance: { colorHex: '#00ffff' } } },
    });
    expect(resolveStairMaterial(s, 'stair-tread', 2)).toBe(getFaceColorMaterial3D('#00ffff'));
    // άλλο tread → whole-stair
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(getFaceColorMaterial3D('#654321'));
  });

  it('whole-stair appearance ΚΕΡΔΙΖΕΙ του preset component default (materials.tread)', () => {
    const s = stair({ materials: { tread: 'oak', appearance: { colorHex: '#abcdef' } } });
    expect(resolveStairMaterial(s, 'stair-tread', 0)).toBe(getFaceColorMaterial3D('#abcdef'));
  });
});
