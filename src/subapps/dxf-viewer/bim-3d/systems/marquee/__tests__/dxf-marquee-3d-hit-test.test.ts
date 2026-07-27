/**
 * ADR-692 Φ2 — collectDxfMarqueeHits: window/crossing πάνω στο raw DXF wireframe μέσα στο 3D.
 *
 * Το ορθογώνιο χτίζεται από τις ΠΡΑΓΜΑΤΙΚΕΣ προβολές των άκρων (μέσω του ΙΔΙΟΥ projector που
 * χρησιμοποιεί ο κώδικας) — άρα το test δεν κουμπώνει σε συγκεκριμένο στήσιμο κάμερας, ελέγχει
 * τη ΣΗΜΑΣΙΟΛΟΓΙΑ: L→R = μόνο ό,τι είναι ΟΛΟ μέσα, R→L = ό,τι αγγίζει.
 */

import * as THREE from 'three';
import type { DxfScene, DxfEntityUnion } from '../../../../canvas-v2/dxf-canvas/dxf-types';
import { dxfPlanToWorld, createWorldToScreenProjector } from '../../../viewport/coordinate-transforms';
import { createScreenClipper } from '../../../viewport/screen-projection-clip';
import { collectDxfMarqueeHits } from '../dxf-marquee-3d-hit-test';

const CANVAS_W = 800;
const CANVAS_H = 600;

function createCanvas(): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H, width: CANVAS_W, height: CANVAS_H, x: 0, y: 0,
    }),
    clientWidth: CANVAS_W,
    clientHeight: CANVAS_H,
  } as unknown as HTMLElement;
}

/** Top-down ορθογραφική κάμερα (κάτοψη) — η κανονική «2Δ-σαν» θέα του DXF υποστρώματος. */
function createCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 1000);
  camera.up.set(0, 0, -1); // κοιτάζοντας κατακόρυφα, το «πάνω» της οθόνης πρέπει να είναι οριζόντιο
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function line(id: string, ax: number, ay: number, bx: number, by: number): DxfEntityUnion {
  return {
    id, type: 'line', visible: true,
    start: { x: ax, y: ay }, end: { x: bx, y: by },
  } as DxfEntityUnion;
}

function scene(entities: DxfEntityUnion[]): DxfScene {
  return { entities, layers: [], bounds: null, units: 'mm' };
}

describe('collectDxfMarqueeHits', () => {
  const camera = createCamera();
  const canvas = createCanvas();
  const project = createWorldToScreenProjector(camera, canvas);

  /** Η προβολή ενός plan-mm σημείου σε client px (ίδια διαδρομή με τον κώδικα). */
  const screenOf = (x: number, y: number): { x: number; y: number } => {
    const p = project(dxfPlanToWorld(x, y, 0));
    if (!p) throw new Error('point behind camera');
    return p;
  };

  it('WINDOW (L→R): πιάνει τη γραμμή που είναι ΟΛΗ μέσα', () => {
    const a = screenOf(0, 0);
    const b = screenOf(1000, 1000);
    const pad = 20;
    const start = { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad };
    const end = { x: Math.max(a.x, b.x) + pad, y: Math.max(a.y, b.y) + pad };

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([line('l1', 0, 0, 1000, 1000)]), floorElevationMm: 0 }],
      camera, canvas, startPt: start, endPt: end,
    });

    expect(res.selectionType).toBe('window');
    expect(res.ids).toEqual(['l1']);
    expect([...res.scopeIds]).toEqual(['l1']);
  });

  it('WINDOW: ΔΕΝ πιάνει γραμμή που βγαίνει έξω από το κουτί', () => {
    const a = screenOf(0, 0);
    const mid = screenOf(500, 500);
    const start = { x: Math.min(a.x, mid.x), y: Math.min(a.y, mid.y) };
    const end = { x: Math.max(a.x, mid.x), y: Math.max(a.y, mid.y) };

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([line('l1', 0, 0, 1000, 1000)]), floorElevationMm: 0 }],
      camera, canvas, startPt: start, endPt: end,
    });

    expect(res.ids).toEqual([]);
  });

  it('CROSSING (R→L): πιάνει γραμμή που απλώς περνά από το κουτί', () => {
    const a = screenOf(0, 0);
    const mid = screenOf(500, 500);
    // R→L ⇒ startX > endX
    const left = { x: Math.min(a.x, mid.x), y: Math.min(a.y, mid.y) };
    const right = { x: Math.max(a.x, mid.x), y: Math.max(a.y, mid.y) };

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([line('l1', 0, 0, 1000, 1000)]), floorElevationMm: 0 }],
      camera, canvas, startPt: right, endPt: left,
    });

    expect(res.selectionType).toBe('crossing');
    expect(res.ids).toEqual(['l1']);
  });

  it('αγνοεί αόρατες οντότητες αλλά τις κρατά στο scope (για add/subtract)', () => {
    const hidden = { ...line('l1', 0, 0, 1000, 1000), visible: false } as DxfEntityUnion;
    const a = screenOf(-100, -100);
    const b = screenOf(1100, 1100);

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([hidden]), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      endPt: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    });

    expect(res.ids).toEqual([]);
    expect(res.scopeIds.has('l1')).toBe(true);
  });

  it('πολλαπλοί όροφοι: κάθε πάτωμα ελέγχεται στο δικό του υψόμετρο', () => {
    const a = screenOf(0, 0);
    const b = screenOf(1000, 1000);
    const pad = 20;

    const res = collectDxfMarqueeHits({
      floors: [
        { scene: scene([line('ground', 0, 0, 1000, 1000)]), floorElevationMm: 0 },
        { scene: scene([line('upper', 0, 0, 1000, 1000)]), floorElevationMm: 3000 },
      ],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad },
      endPt: { x: Math.max(a.x, b.x) + pad, y: Math.max(a.y, b.y) + pad },
    });

    // Κάτοψη ⇒ η κατακόρυφη μετατόπιση δεν αλλάζει την προβολή: πιάνονται και οι δύο όροφοι.
    expect(res.ids.sort()).toEqual(['ground', 'upper']);
  });

  it('τύποι χωρίς γραμμική αναπαράσταση (π.χ. dimension) αγνοούνται', () => {
    const unsupported = { id: 'd1', type: 'dimension', visible: true } as unknown as DxfEntityUnion;
    const a = screenOf(-1000, -1000);
    const b = screenOf(1000, 1000);

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([unsupported]), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      endPt: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    });

    expect(res.ids).toEqual([]);
  });
});

/**
 * ADR-717 Φ Γ — Η ΚΛΑΣΗ ΠΟΥ ΤΑ ΠΑΡΑΠΑΝΩ ΔΕΝ ΑΓΓΙΖΑΝ.
 *
 * Όλα τα tests της πρώτης σουίτας τρέχουν σε **ορθογραφική κάτοψη** με συντεταγμένες 0–1000 **mm**
 * — δηλαδή σε σκηνή μισού μέτρου. Το σφάλμα ζούσε στην αντίθετη άκρη: **προοπτική** κάμερα και
 * αποστάσεις πέρα από το `CAMERA_FAR` (1 km). Ο κοινός projector απέρριπτε ΚΑΘΕ σημείο με
 * `ndc.z > 1`, και σε τοπογραφικό 3 km αυτό ήταν **4/4 σημεία** ⇒ μηδέν επιλογή, ενώ όλα ήταν
 * καθαρά ορατά στην οθόνη (μετρημένο με probe, όχι εικαζόμενο).
 *
 * Δύο ξεχωριστές αιτίες, δύο ξεχωριστές ομάδες παρακάτω:
 *   §Γ1 «μακριά» — δεν έπρεπε ΠΟΤΕ να είναι λόγος απόρριψης·
 *   §Γ2 «πίσω από την κάμερα» — είναι λόγος, αλλά ΤΜΗΜΑΤΙΚΑ, όχι για όλη την οντότητα.
 */

/** Προοπτική κάμερα ψηλά πάνω από τοπογραφικό 3 km: ΚΑΙ ΤΑ ΔΥΟ άκρα πέρα από το far plane. */
function createFarPerspectiveCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, CANVAS_W / CANVAS_H, 0.1, 1000);
  camera.position.set(1500, 2500, 2500);
  camera.lookAt(1500, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

/** Κάμερα ΜΕΣΑ στο τοπογραφικό, κοιτώντας κατά μήκος του: το ένα άκρο μένει ΠΙΣΩ της. */
function createStraddlingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, CANVAS_W / CANVAS_H, 0.1, 1000);
  camera.position.set(100, 0.5, 0);
  camera.lookAt(3000, 0.5, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

/** Πολυγραμμή 3 km κατά μήκος του άξονα X (plan mm ⇒ world 0…3000 m). */
const TOPO_3KM = (): DxfScene => scene([line('topo', 0, 0, 3_000_000, 0)]);

describe('§Γ1 — τοπογραφικό 3 km σε προοπτική κάμερα (πέρα από CAMERA_FAR)', () => {
  const camera = createFarPerspectiveCamera();
  const canvas = createCanvas();
  const clipper = createScreenClipper(camera, canvas);

  const screenOf = (x: number, y: number): { x: number; y: number } => {
    const p = clipper.worldToScreenPx(dxfPlanToWorld(x, y, 0));
    if (!p) throw new Error('το σημείο δεν προβάλλεται — το ΙΔΙΟ το σφάλμα του ADR-717 Φ Γ');
    return p;
  };

  it('WINDOW: ΟΛΟ μέσα ⇒ πιάνεται — πριν επέστρεφε [] επειδή 4/4 σημεία ήταν «εκτός»', () => {
    const a = screenOf(0, 0);
    const b = screenOf(3_000_000, 0);
    const pad = 40;
    const res = collectDxfMarqueeHits({
      floors: [{ scene: TOPO_3KM(), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad },
      endPt: { x: Math.max(a.x, b.x) + pad, y: Math.max(a.y, b.y) + pad },
    });
    expect(res.selectionType).toBe('window');
    expect(res.ids).toEqual(['topo']);
  });

  it('WINDOW: ορθογώνιο που ΔΕΝ την περικλείει ⇒ ΔΕΝ πιάνεται (η σημασιολογία μένει αυστηρή)', () => {
    const a = screenOf(0, 0);
    const mid = screenOf(1_500_000, 0);
    const res = collectDxfMarqueeHits({
      floors: [{ scene: TOPO_3KM(), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: Math.min(a.x, mid.x), y: Math.min(a.y, mid.y) - 20 },
      endPt: { x: Math.max(a.x, mid.x), y: Math.max(a.y, mid.y) + 20 },
    });
    expect(res.ids).toEqual([]);
  });

  it('CROSSING: κουτί που απλώς την τέμνει στη μέση ⇒ πιάνεται', () => {
    const mid = screenOf(1_500_000, 0);
    const res = collectDxfMarqueeHits({
      floors: [{ scene: TOPO_3KM(), floorElevationMm: 0 }],
      camera, canvas,
      // R→L ⇒ crossing
      startPt: { x: mid.x + 30, y: mid.y + 30 },
      endPt: { x: mid.x - 30, y: mid.y - 30 },
    });
    expect(res.selectionType).toBe('crossing');
    expect(res.ids).toEqual(['topo']);
  });
});

describe('§Γ2 — οντότητα εν μέρει ΠΙΣΩ από την κάμερα', () => {
  const camera = createStraddlingCamera();
  const canvas = createCanvas();
  const wholeScreen = { min: { x: 0, y: 0 }, max: { x: CANVAS_W, y: CANVAS_H } };

  it('CROSSING: πιάνεται από το ΟΡΑΤΟ της κομμάτι — το κομμένο άκρο δεν ακυρώνει τα υπόλοιπα', () => {
    const res = collectDxfMarqueeHits({
      floors: [{ scene: TOPO_3KM(), floorElevationMm: 0 }],
      camera, canvas,
      // R→L πάνω σε ΟΛΗ την οθόνη ⇒ crossing
      startPt: { x: wholeScreen.max.x, y: wholeScreen.max.y },
      endPt: { x: wholeScreen.min.x, y: wholeScreen.min.y },
    });
    expect(res.selectionType).toBe('crossing');
    expect(res.ids).toEqual(['topo']);
  });

  it('WINDOW: ΔΕΝ πιάνεται ούτε με πλαίσιο ΟΛΗ την οθόνη — «κομμένο» ⇒ «δεν είναι όλο μέσα»', () => {
    // Το κρίσιμο anchor της Φ Γ: αν χαλαρώσει, μια οντότητα που ξεφεύγει από το πλαίσιο θα
    // δηλώνεται «όλη μέσα». Το CROSSING παραπάνω και το WINDOW εδώ βλέπουν την ΙΔΙΑ γεωμετρία.
    const res = collectDxfMarqueeHits({
      floors: [{ scene: TOPO_3KM(), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: wholeScreen.min.x, y: wholeScreen.min.y },
      endPt: { x: wholeScreen.max.x, y: wholeScreen.max.y },
    });
    expect(res.selectionType).toBe('window');
    expect(res.ids).toEqual([]);
  });

  it('ΟΛΗ πίσω από την κάμερα ⇒ δεν πιάνεται σε κανέναν από τους δύο τρόπους', () => {
    const behind = scene([line('behind', -500_000, 0, -100_000, 0)]); // world x −500…−100, πίσω από x=100
    for (const [startPt, endPt] of [
      [{ x: 0, y: 0 }, { x: CANVAS_W, y: CANVAS_H }],
      [{ x: CANVAS_W, y: CANVAS_H }, { x: 0, y: 0 }],
    ]) {
      const res = collectDxfMarqueeHits({
        floors: [{ scene: behind, floorElevationMm: 0 }],
        camera, canvas, startPt, endPt,
      });
      expect(res.ids).toEqual([]);
      expect(res.scopeIds.has('behind')).toBe(true); // μένει στο scope για add/subtract
    }
  });
});
