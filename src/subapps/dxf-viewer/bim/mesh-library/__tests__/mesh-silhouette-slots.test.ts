/**
 * ADR-683 Φ5 — per-slot top-view silhouettes (material poché). Pure geometry, no GL.
 *
 * Επικυρώνει: (α) διαχωρισμός multi-material mesh σε ένα slot ανά υλικό, (β) painters order
 * (χαμηλότερο πρώτο), (γ) multi-component ανά slot (τα δύο μπράτσα = δύο δαχτυλίδια), (δ)
 * single-material → ένα slot, (ε) κενό object → κενό.
 */

import * as THREE from 'three';
import { computeTopSilhouettePerSlot } from '../mesh-silhouette-slots';

/** Non-indexed unit quad (2 τρίγωνα) στο X/Z επίπεδο, σε ύψος `y`, εύρος [x0, x0+1] × [0, 1]. */
function quadTris(x0: number, y: number): number[] {
  const x1 = x0 + 1;
  return [
    x0, y, 0, x1, y, 0, x1, y, 1,
    x0, y, 0, x1, y, 1, x0, y, 1,
  ];
}

function namedMat(name: string): THREE.MeshStandardMaterial {
  return Object.assign(new THREE.MeshStandardMaterial(), { name });
}

/** Ένα multi-material mesh: ένα quad ανά slot (δικό του materialIndex μέσω `geometry.groups`). */
function multiSlotMesh(slots: Array<{ name: string; y: number; x0?: number }>): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const mats: THREE.Material[] = [];
  slots.forEach((s, i) => {
    const tris = quadTris(s.x0 ?? 0, s.y);
    geo.addGroup(pos.length / 3, tris.length / 3, i);
    pos.push(...tris);
    mats.push(namedMat(s.name));
  });
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return new THREE.Mesh(geo, mats);
}

describe('computeTopSilhouettePerSlot', () => {
  it('σπάει multi-material mesh σε ένα slot ανά υλικό, χαμηλότερο πρώτο (painters order)', () => {
    const mesh = multiSlotMesh([
      { name: 'leather', y: 1 }, // ψηλά
      { name: 'metal', y: 0 },   // χαμηλά
    ]);

    const slots = computeTopSilhouettePerSlot(mesh);

    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.materialName)).toEqual(['metal', 'leather']);
    for (const s of slots) expect(s.contours.length).toBeGreaterThanOrEqual(1);
  });

  it('same-slot ασυνεχείς περιοχές → πολλαπλά contours (τα δύο μπράτσα)', () => {
    // ΕΝΑ υλικό «leather», δύο χωριστά quads (x0=0 και x0=3) με κενό ανάμεσα → 2 components.
    const mesh = multiSlotMesh([
      { name: 'leather', y: 0, x0: 0 },
      { name: 'leather', y: 0, x0: 3 },
    ]);

    const slots = computeTopSilhouettePerSlot(mesh);

    expect(slots).toHaveLength(1);
    expect(slots[0].materialName).toBe('leather');
    expect(slots[0].contours.length).toBe(2);
  });

  it('single-material mesh → ένα slot', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), namedMat('concrete'));

    const slots = computeTopSilhouettePerSlot(mesh);

    expect(slots).toHaveLength(1);
    expect(slots[0].materialName).toBe('concrete');
  });

  it('κενό object → κενό (renderer πέφτει στη single silhouette / ορθογώνιο)', () => {
    expect(computeTopSilhouettePerSlot(new THREE.Group())).toEqual([]);
  });
});
