/**
 * ADR-539 Φ4d / ADR-679 Φ2b — `getFaceMaterial3D` / `getFaceColorMaterial3D` (per-face
 * "Paint on face" material factories, the SOLE construction path for painted-face textured
 * materials now that `resolveFaceMaterial` is a thin delegate — see
 * face-appearance-material.test.ts).
 *
 * ADR-679 Φ2b regression fix — `getFaceMaterial3D` now returns `MeshStandardMaterial | null`:
 * it is a real texture ONLY when realistic materials are ON AND the id is a `bmat_*` library
 * material with an uploaded albedo (`hasFaceTexture`). Any other case (realistic OFF, or a
 * flat/unknown/non-bmat id) → `null`, so the caller falls through to the legacy flat-colour
 * path instead of silently collapsing to a wrong/default texture.
 *
 * `realisticMaterials` is OFF by default (store default → 'shaded-edges' preset, see
 * `bim-render-settings-types.ts` `DEFAULT_VISUAL_STYLE`) — the jest default here — so this
 * suite exercises the null-path without loading any texture asset. Driving the non-null
 * (realistic ON + uploaded albedo) branch would require faking the user-material-registry's
 * texture-set cache, which is out of scope for this unit and belongs to that registry's own
 * suite — not fabricated here.
 */

import * as THREE from 'three';
import {
  getFaceMaterial3D,
  getFaceColorMaterial3D,
} from '../MaterialCatalog3D';

describe('getFaceColorMaterial3D', () => {
  it('builds a matte DoubleSide MeshStandardMaterial with the requested colour', () => {
    const mat = getFaceColorMaterial3D('#c0392b');
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.roughness).toBe(0.92);
    expect(mat.metalness).toBe(0);
    expect(mat.color.equals(new THREE.Color('#c0392b'))).toBe(true);
  });

  it('caches per hex — same hex returns the SAME instance', () => {
    const a = getFaceColorMaterial3D('#27ae60');
    const b = getFaceColorMaterial3D('#27ae60');
    expect(a).toBe(b);
  });

  it('different hex → distinct instance', () => {
    const a = getFaceColorMaterial3D('#2563eb');
    const b = getFaceColorMaterial3D('#dc2626');
    expect(a).not.toBe(b);
  });
});

describe('getFaceMaterial3D — realistic OFF (jest default store state)', () => {
  it('returns null for a plain catalog id (not a bmat_* library material)', () => {
    expect(getFaceMaterial3D('mat-concrete-c25')).toBeNull();
  });

  it('returns null for a bmat_* library id too — realistic OFF short-circuits before the texture check', () => {
    expect(getFaceMaterial3D('bmat_oak')).toBeNull();
  });

  it('returns null for an unknown/garbage id', () => {
    expect(getFaceMaterial3D('not-a-real-material-id')).toBeNull();
  });
});
