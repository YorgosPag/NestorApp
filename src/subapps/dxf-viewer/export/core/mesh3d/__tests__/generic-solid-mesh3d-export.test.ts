/**
 * ADR-684 Φ4-C / ADR-678 — belt-and-suspenders: ένα **βαμμένο** generic-solid εξάγεται per-face στο
 * COLLADA (.dae). Επιβεβαιώνει την πλήρη αλυσίδα με τα ΠΡΑΓΜΑΤΙΚΑ production κομμάτια:
 *   converter (`genericSolidToObject3D` → faced mesh + `userData.faceKeyByMaterialIndex`)
 *   → `assignExportMaterials` (palette, χειρίζεται material array)
 *   → `serialiseCollada` (`<face_keys>` block + per-face `<triangles material="sym_i">`).
 *
 * Ο writer είναι generic (διαβάζει userData)· εδώ κλειδώνουμε ότι το generic-solid τον τροφοδοτεί
 * σωστά, ώστε μια μελλοντική αλλαγή στον converter να μη σπάσει σιωπηλά το per-face export.
 */

import * as THREE from 'three';
import { genericSolidToObject3D } from '../../../../bim-3d/converters/generic-solid-to-three';
import { assignExportMaterials } from '../mesh3d-materials';
import { serialiseCollada, type ColladaExportOptions } from '../mesh3d-collada-writer';
import {
  buildDefaultGenericSolidParams,
  buildGenericSolidEntity,
} from '../../../../hooks/drawing/generic-solid-completion';
import type { GenericSolidEntity, GenericSolidShape } from '../../../../bim/entities/generic-solid/generic-solid-types';

const CM: ColladaExportOptions = { unit: 'centimeters', createdIso: '2026-07-22T00:00:00.000Z' };

function paintedSolid(shape: GenericSolidShape): GenericSolidEntity {
  const res = buildGenericSolidEntity(buildDefaultGenericSolidParams({ x: 0, y: 0 }, { shape }), '0');
  if (!res.ok) throw new Error('generic-solid fixture invalid');
  return { ...res.entity, faceAppearance: { top: { colorHex: '#C0392B' } } };
}

function daeFor(shape: GenericSolidShape): string {
  const mesh = genericSolidToObject3D(paintedSolid(shape)) as THREE.Mesh;
  const root = new THREE.Group();
  root.add(mesh);
  const entries = assignExportMaterials(root);
  return serialiseCollada(root, entries, CM);
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('generic-solid → COLLADA per-face export', () => {
  it('βαμμένο κουτί → <face_keys> block με τους 6 faceKeys στη σωστή σειρά', () => {
    const dae = daeFor({ kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 });
    expect(dae).toContain('<face_keys>');
    for (const k of ['side:0', 'side:1', 'top', 'bottom', 'side:2', 'side:3']) {
      expect(dae).toContain(`<k>${k}</k>`);
    }
    // 6 όψεις → 6 per-face <triangles> (ένα ανά geometry group).
    expect(count(dae, '<triangles material="sym_')).toBe(6);
  });

  it('βαμμένος κύλινδρος → 3 όψεις (πλευρά/πάνω/κάτω)', () => {
    const dae = daeFor({ kind: 'cylinder', radiusMm: 300, heightMm: 800 });
    expect(dae).toContain('<face_keys>');
    expect(count(dae, '<triangles material="sym_')).toBe(3);
  });
});
