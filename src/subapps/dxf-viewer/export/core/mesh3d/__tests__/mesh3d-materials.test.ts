/**
 * ADR-668 §4.8 — το χρώμα υλικού διαβάζεται από ΚΑΘΕ υλικό με `.color`, όχι μόνο MeshStandard.
 *
 * Ρίζα: ο οπλισμός (ADR-463) είναι `MeshBasicMaterial` (crimson). Το παλιό `isMeshStandard`-only
 * check τον έριχνε στο γκρι fallback (`mat_808080`) → ο κλωβός θα έβγαινε γκρι στο C4D αντί κόκκινος.
 */

import * as THREE from 'three';
import { assignExportMaterials, buildMaterialBaseline, type ExportMaterialEntry } from '../mesh3d-materials';
import { HIDDEN_NAME_PREFIX } from '../mesh3d-naming';

describe('assignExportMaterials — non-Standard material colour (ADR-668 §4.8)', () => {
  it('keeps a MeshBasicMaterial colour (rebar crimson), not the grey fallback', () => {
    const root = new THREE.Group();
    const rebar = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xdc143c }),
    );
    rebar.userData = { bimId: 'col-1', bimType: 'column' };
    root.add(rebar);

    const table = assignExportMaterials(root);

    expect(table).toHaveLength(1);
    expect(table[0].name).toBe('mat_dc143c'); // χρωματικό όνομα, όχι το γκρι 808080
    expect(table[0].color.getHex()).toBe(0xdc143c);
    expect((rebar.material as THREE.Material).name).toBe('mat_dc143c');
  });

  it('still resolves MeshStandard colours unchanged (no regression)', () => {
    const root = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x9e9e9e }),
    );
    wall.userData = { bimId: 'w-1', bimType: 'wall' };
    root.add(wall);

    const table = assignExportMaterials(root);

    expect(table[0].name).toBe('mat_9e9e9e');
    expect(table[0].color.getHex()).toBe(0x9e9e9e);
  });
});

describe('buildMaterialBaseline (ADR-683 §7, Break C)', () => {
  const entry = (name: string, hex: number): ExportMaterialEntry => ({
    name,
    color: new THREE.Color(hex),
    opacity: 1,
    transparent: false,
  });

  it('maps clean material name → sRGB "#rrggbb"', () => {
    const baseline = buildMaterialBaseline([entry('mat-concrete-c25', 0x808080), entry('mat_a1b2c3', 0xa1b2c3)]);

    expect(baseline.get('mat-concrete-c25')).toBe('#808080');
    expect(baseline.get('mat_a1b2c3')).toBe('#a1b2c3');
  });

  it('collapses HIDDEN_<name> and <name> to ONE clean-name entry (format-agnostic baseline)', () => {
    const baseline = buildMaterialBaseline([
      entry('mat-concrete-c25', 0x808080),
      entry(`${HIDDEN_NAME_PREFIX}_mat-concrete-c25`, 0x808080),
    ]);

    expect(baseline.size).toBe(1);
    expect(baseline.get('mat-concrete-c25')).toBe('#808080');
  });

  it('first entry wins for a repeated clean name (deterministic)', () => {
    const baseline = buildMaterialBaseline([entry('mat-x', 0x111111), entry('mat-x', 0x222222)]);

    expect(baseline.get('mat-x')).toBe('#111111');
  });
});
