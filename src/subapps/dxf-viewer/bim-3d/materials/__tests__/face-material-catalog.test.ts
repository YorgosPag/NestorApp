/**
 * ADR-539 Φ4d / ADR-679 Φ2b — `getFaceMaterial3D` / `getFaceColorMaterial3D` (per-face
 * "Paint on face" material factories, the SOLE construction path for painted-face textured
 * materials now that `resolveFaceMaterial` is a thin delegate — see
 * face-appearance-material.test.ts).
 *
 * ADR-679 Φ2b regression fix — `getFaceMaterial3D` now returns `MeshStandardMaterial | null`:
 *   - realistic materials OFF → always `null` (unchanged, regardless of id shape).
 *   - realistic materials ON → non-null DoubleSide material when the id is EITHER
 *     (a) a `bmat_*` library material with an uploaded albedo, OR
 *     (b) a catalog `mat-*`/`elem-*` id whose resolved key has a mapped texture slug
 *         (brick/stone/wood/tile/concrete/metal/plaster/roof-tiles) — the `hasFaceTexture`
 *         gate (`MaterialCatalog3D.ts`).
 *   - realistic ON but the id has NO texture path → `null` (foreign non-"mat-"/"elem-" id, or a
 *     "mat-" / "elem-" id with no mapped slug e.g. `mat-glass`) — so the caller falls through to
 *     the legacy flat-colour path instead of a wrong/default texture (no concrete fallback for
 *     a foreign id like a wall-covering `'paint-red'`).
 *
 * `realisticMaterials` is OFF by default (store default → 'shaded-edges' preset, see
 * `bim-render-settings-types.ts` `DEFAULT_VISUAL_STYLE`) — the jest default here. The
 * "realistic ON" suite below flips the store for its own tests only and restores OFF
 * afterwards so it doesn't leak into sibling suites (mirrors the pattern in
 * `MaterialCatalog3D-visual-style.test.ts`).
 *
 * NOT covered here: the `bmat_*` + uploaded-albedo non-null branch. That would require
 * faking the user-material-registry's texture-set cache (a loaded albedo asset), which is
 * out of scope for this unit and belongs to that registry's own suite — not fabricated here.
 * The catalog `mat-brick` case below drives the SAME `ensureDoubleSided` gate/wrapping logic
 * (`getMaterial3D` returns its flat singleton because no texture is actually loaded — that's
 * fine; the point under test is that the gate itself returns a non-null DoubleSide variant).
 */

import * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import {
  getFaceMaterial3D,
  getFaceColorMaterial3D,
  withAccurateGlassForExport,
} from '../MaterialCatalog3D';
import { setUserMaterials, __resetUserMaterialRegistryForTests } from '../user-material-registry';
import type { BimMaterial } from '../../../bim/types/bim-material-types';
import { DEFAULT_GLASS_QUALITY } from '../../../config/bim-visual-style';

jest.mock('../../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

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

describe('getFaceMaterial3D — realistic ON (catalog-textured branch, ADR-679 Φ2b gate extension)', () => {
  beforeEach(() => {
    useBimRenderSettingsStore.getState().setRealisticMaterials(true);
  });

  afterEach(() => {
    // restore the suite-wide default (realistic OFF) so this doesn't leak into sibling suites.
    useBimRenderSettingsStore.getState().setRealisticMaterials(false);
  });

  it('mat-brick (mapped texture slug) → non-null DoubleSide material', () => {
    const mat = getFaceMaterial3D('mat-brick');
    expect(mat).not.toBeNull();
    expect(mat?.side).toBe(THREE.DoubleSide);
  });

  it('mat-glass (no mapped texture slug) → null, even with realistic ON', () => {
    expect(getFaceMaterial3D('mat-glass')).toBeNull();
  });

  it('paint-red (foreign id, not mat-/elem- prefixed) → null, even with realistic ON', () => {
    expect(getFaceMaterial3D('paint-red')).toBeNull();
  });
});

// ADR-687 Φ8 — μια όψη βαμμένη με library `bmat_*` που κουβαλά appearance ΧΩΡΙΣ υφή (π.χ. γυαλί:
// transmission/opacity) πρέπει να render-άρει το ΠΡΑΓΜΑΤΙΚΟ υλικό (MeshPhysicalMaterial), όχι flat
// opaque χρώμα. Πριν το Φ8 το `getFaceMaterial3D` επέστρεφε null (no-texture) → συμπαγής κολώνα.
describe('getFaceMaterial3D — realistic ON, bmat_* appearance-only (ADR-687 Φ8 glass/metal)', () => {
  const glass: BimMaterial = {
    id: 'bmat_glass_test',
    scope: 'company',
    nameEl: 'Γυαλί', nameEn: 'Glass',
    category: 'other',
    density: null, defaultThickness: null, fireRating: 'none',
    atoeCategory: 'X', atoeArticle: null, defaultUnitCost: null, defaultUnit: 'm2',
    brand: null, brandModel: null, notes: null,
    thumbnailUrl: null, pbrTextures: null,
    appearance: { baseColorHex: '#27ae60', metalness: 0, roughness: 0.05, opacity: 0.4, transmission: 1, ior: 1.5 },
    builtin: false, companyId: 'c1', projectId: null,
    createdBy: 'u1', createdAt: null as unknown as BimMaterial['createdAt'],
    updatedBy: 'u1', updatedAt: null as unknown as BimMaterial['updatedAt'],
  };

  beforeEach(() => {
    __resetUserMaterialRegistryForTests();
    setUserMaterials([glass]);
    useBimRenderSettingsStore.getState().setRealisticMaterials(true);
  });
  afterEach(() => {
    useBimRenderSettingsStore.getState().setRealisticMaterials(false);
    useBimRenderSettingsStore.getState().setGlassQuality(DEFAULT_GLASS_QUALITY);
    __resetUserMaterialRegistryForTests();
  });

  it('→ non-null DoubleSide υλικό με ΤΑΥΤΟΤΗΤΑ, όχι flat opaque χρώμα', () => {
    const mat = getFaceMaterial3D('bmat_glass_test');
    expect(mat).not.toBeNull();
    expect(mat?.side).toBe(THREE.DoubleSide);
    expect(mat?.userData['nestorMaterialId']).toBe('bmat_glass_test');
    // Το κρίσιμο του Φ8: ΔΕΝ είναι το legacy flat-χρώμα υλικό (roughness 0.92 opaque).
    expect(mat?.transparent).toBe(true);
    expect(mat?.opacity).toBeLessThan(1);
  });

  /**
   * ADR-687 **Φ9** — ο άξονας `glassQuality`, που το Φ8 δεν γνώριζε.
   *
   * ⚠️ ΙΣΤΟΡΙΚΟ (ADR-693): το test παραπάνω απαιτούσε αρχικά `transmission > 0` **χωρίς** να
   * ορίζει ποιότητα γυαλιού. Όταν η Φ9 πρόσθεσε το `glassQuality` με **default `'light'`** — που
   * ΣΚΟΠΙΜΑ ανταλλάσσει το ακριβό transmission με φθηνό `opacity` alpha-blend στο ζωντανό
   * viewport — το test έγινε κόκκινο στο main και έμεινε έτσι, χαρακτηρισμένο ως «προϋπάρχον».
   * **Δεν ήταν σπασμένος κώδικας· ήταν test που δεν ενημερώθηκε.** Πλέον ελέγχονται ΚΑΙ ΟΙ ΔΥΟ
   * ποιότητες ρητά, ώστε ένα μελλοντικό default flip να μη σκοτώσει ξανά σιωπηλά την κάλυψη.
   */
  it('light (default) → φθηνό alpha-blend: transmission ΣΒΗΣΤΟ, opacity ενεργό', () => {
    useBimRenderSettingsStore.getState().setGlassQuality('light');
    const mat = getFaceMaterial3D('bmat_glass_test');
    expect((mat as THREE.MeshPhysicalMaterial).transmission ?? 0).toBe(0);
    expect(mat?.opacity).toBeCloseTo(0.4, 5); // το ρητό appearance.opacity διατηρείται
  });

  it('accurate → πλήρες MeshPhysicalMaterial refraction', () => {
    useBimRenderSettingsStore.getState().setGlassQuality('accurate');
    const mat = getFaceMaterial3D('bmat_glass_test');
    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((mat as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0);
  });

  it('το export μένει ΠΑΝΤΑ accurate, ακόμη κι όταν το viewport είναι light', () => {
    useBimRenderSettingsStore.getState().setGlassQuality('light');
    const exported = withAccurateGlassForExport(() => getFaceMaterial3D('bmat_glass_test'));
    expect((exported as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0);
    // ...και δεν μολύνει το cache του ζωντανού viewport (ADR-687 Φ9).
    expect((getFaceMaterial3D('bmat_glass_test') as THREE.MeshPhysicalMaterial).transmission ?? 0).toBe(0);
  });
});
