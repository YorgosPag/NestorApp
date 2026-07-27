/**
 * ADR-665 Φ2 — clip scope guard.
 *
 * Το σφάλμα που φυλάει: το `LineBasicMaterial` είναι clippable **ΜΟΝΟ** στο scope `'topo'`, και το
 * scope **κληρονομείται** προς τα κάτω. Άρα αρκεί το υπόστρωμα DXF να βρεθεί κάτω από topo root
 * για να αρχίσει να κόβεται από την κοπή του εδάφους — σιωπηλά, χωρίς σφάλμα, ενώ τα Canvas2D
 * overlays (λαβές/hover/επιλογή) συνεχίζουν να σχεδιάζονται κανονικά γιατί δεν περνούν από GPU
 * clipping. Η ασυμμετρία μοιάζει με σφάλμα προβολής και στέλνει τη διάγνωση σε near/far plane.
 *
 * Τα tests κλειδώνουν ΚΑΙ τα δύο σκέλη του συμβολαίου:
 *   • ο φύλακας ΒΛΕΠΕΙ τη διαρροή (αλλιώς είναι διακοσμητικός)·
 *   • ο φύλακας ΔΕΝ αλλάζει τι γράφεται (αλλιώς είναι κρυφή αλλαγή συμπεριφοράς).
 *
 * @see ../clip-scope-guard.ts
 * @see HANDOFFS/3d-wireframe-clipped-before-viewport-bottom.md
 */

import * as THREE from 'three';
import { applyClippingPlanes, type ScopeClipPlanes } from '../section-clip-applicator';
import {
  CLIP_SCOPE_LOCK_KEY,
  getClipScopeLeaks,
  lockClipScope,
  readClipScopeLock,
  resetClipScopeGuard,
} from '../clip-scope-guard';

const BUILDING_PLANE = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);
const TERRAIN_PLANE = new THREE.Plane(new THREE.Vector3(0, -1, 0), 5);
const PLANES: ScopeClipPlanes = { default: [BUILDING_PLANE], topo: [TERRAIN_PLANE] };

/** Read `clippingPlanes` off any material without leaking `any` into the test. */
function planesOf(material: THREE.Material): THREE.Plane[] | null {
  return (material as THREE.Material & { clippingPlanes?: THREE.Plane[] | null }).clippingPlanes ?? null;
}

/**
 * The real shape built by `DxfToThreeConverter.buildLineGroup`: a `dxf-wireframe-floor` group that
 * locks `'default'`, holding `LineSegments` with `LineBasicMaterial`.
 */
function dxfUnderlayGroup(): { group: THREE.Group; material: THREE.LineBasicMaterial } {
  const group = new THREE.Group();
  group.name = 'dxf-wireframe-floor';
  lockClipScope(group, 'default');
  const material = new THREE.LineBasicMaterial();
  group.add(new THREE.LineSegments(new THREE.BufferGeometry(), material));
  return { group, material };
}

/** A terrain scene-layer root, exactly as `seatTopoLayerRoot` seats it. */
function topoLayerRoot(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'topo-layer';
  root.userData['topoClipScope'] = true;
  return root;
}

beforeEach(() => {
  resetClipScopeGuard();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('lockClipScope / readClipScopeLock', () => {
  it('round-trips a locked scope through userData', () => {
    const obj = new THREE.Group();
    expect(readClipScopeLock(obj)).toBeNull();
    lockClipScope(obj, 'default');
    expect(obj.userData[CLIP_SCOPE_LOCK_KEY]).toBe('default');
    expect(readClipScopeLock(obj)).toBe('default');
    lockClipScope(obj, 'topo');
    expect(readClipScopeLock(obj)).toBe('topo');
  });

  it('treats an unknown userData value as «no lock» instead of trusting it', () => {
    const obj = new THREE.Group();
    obj.userData[CLIP_SCOPE_LOCK_KEY] = 'nonsense';
    expect(readClipScopeLock(obj)).toBeNull();
  });
});

describe('the healthy scene — the guard must stay completely silent', () => {
  it('records NOTHING when the DXF underlay sits under the scene root', () => {
    const scene = new THREE.Scene();
    const { group, material } = dxfUnderlayGroup();
    scene.add(group);

    applyClippingPlanes(scene, PLANES);

    expect(getClipScopeLeaks()).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
    // `LineBasicMaterial` is NOT clippable in `'default'` → the underlay stays unclipped. This is
    // the whole point: the 2D drawing must never be cut by the building's section.
    expect(planesOf(material)).toBeNull();
  });

  it('records nothing for terrain content that legitimately lives in the topo scope', () => {
    const scene = new THREE.Scene();
    const root = topoLayerRoot();
    const contourMaterial = new THREE.LineBasicMaterial();
    root.add(new THREE.LineSegments(new THREE.BufferGeometry(), contourMaterial));
    scene.add(root);

    applyClippingPlanes(scene, PLANES);

    expect(getClipScopeLeaks()).toHaveLength(0);
    expect(planesOf(contourMaterial)).toEqual([TERRAIN_PLANE]);
  });
});

describe('the leak — DXF underlay re-parented under a terrain root', () => {
  function leakingScene() {
    const scene = new THREE.Scene();
    const root = topoLayerRoot();
    const { group, material } = dxfUnderlayGroup();
    root.add(group);
    scene.add(root);
    return { scene, material };
  }

  it('records the leak with the path, material type, both scopes and the plane count', () => {
    const { scene } = leakingScene();

    applyClippingPlanes(scene, PLANES);

    const leaks = getClipScopeLeaks();
    expect(leaks).toHaveLength(1);
    expect(leaks[0].lockedScope).toBe('default');
    expect(leaks[0].resolvedScope).toBe('topo');
    expect(leaks[0].materialType).toBe('LineBasicMaterial');
    expect(leaks[0].planeCount).toBe(1);
    // The path must name the terrain root — that is what tells you WHO re-parented it.
    expect(leaks[0].path).toContain('topo-layer');
    expect(leaks[0].path).toContain('dxf-wireframe-floor');
  });

  it('OBSERVES ONLY — the resolved scope still governs, so behaviour is unchanged', () => {
    const { scene, material } = leakingScene();

    applyClippingPlanes(scene, PLANES);

    // The guard must NOT «fix» the clip. Enforcement is a separate, later decision (ADR-665 Φ2):
    // silently forcing `'default'` here could cancel a deliberate future drape-on-terrain feature.
    expect(planesOf(material)).toEqual([TERRAIN_PLANE]);
  });

  it('inherits the lock downward — a nested child with no lock of its own still reports', () => {
    const scene = new THREE.Scene();
    const root = topoLayerRoot();
    const { group } = dxfUnderlayGroup();
    const nested = new THREE.Group();
    nested.name = 'streamed-text';
    nested.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
    group.add(nested);
    root.add(group);
    scene.add(root);

    applyClippingPlanes(scene, PLANES);

    // Both the line segments AND the streamed text mesh below them are covered by the one lock.
    expect(getClipScopeLeaks()).toHaveLength(2);
    expect(getClipScopeLeaks().map((l) => l.path).some((p) => p.includes('streamed-text'))).toBe(true);
  });

  it('warns ONCE per signature — a slider drag re-applies constantly and must not flood', () => {
    const { scene } = leakingScene();

    applyClippingPlanes(scene, PLANES);
    applyClippingPlanes(scene, PLANES);
    applyClippingPlanes(scene, PLANES);

    expect(console.warn).toHaveBeenCalledTimes(1);
    // The ring still gets every occurrence — the dedupe is about console noise, not about data.
    expect(getClipScopeLeaks()).toHaveLength(3);
  });

  it('resetClipScopeGuard clears both the ring and the warned-signature memory', () => {
    const { scene } = leakingScene();
    applyClippingPlanes(scene, PLANES);
    expect(getClipScopeLeaks()).toHaveLength(1);

    resetClipScopeGuard();

    expect(getClipScopeLeaks()).toHaveLength(0);
    applyClippingPlanes(scene, PLANES);
    expect(console.warn).toHaveBeenCalledTimes(2); // signature memory was cleared → warns again
  });
});
