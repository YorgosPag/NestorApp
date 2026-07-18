/**
 * ADR-668 §4.8 — το χρώμα υλικού διαβάζεται από ΚΑΘΕ υλικό με `.color`, όχι μόνο MeshStandard.
 *
 * Ρίζα: ο οπλισμός (ADR-463) είναι `MeshBasicMaterial` (crimson). Το παλιό `isMeshStandard`-only
 * check τον έριχνε στο γκρι fallback (`mat_808080`) → ο κλωβός θα έβγαινε γκρι στο C4D αντί κόκκινος.
 */

import * as THREE from 'three';
import { assignExportMaterials } from '../mesh3d-materials';

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
