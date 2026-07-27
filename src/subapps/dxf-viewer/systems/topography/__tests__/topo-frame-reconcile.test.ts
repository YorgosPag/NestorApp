/**
 * ADR-650 §M10g — ΤΟ ΑΓΚΙΣΤΡΟ ΤΟΥ RECONCILER: το πλαίσιο άλλαξε — ποιος μετακινείται, και πώς.
 *
 * Τρία πράγματα καρφώνονται εδώ, και κανένα δεν είναι «τα νούμερα βγαίνουν»:
 *
 *   1. **Ο μετακινημένος βορράς ΕΠΙΒΙΩΝΕΙ.** Ο χρήστης τον έσυρε στη γωνιά του φύλλου· μετά
 *      την αλλαγή γεωαναφοράς πρέπει να ΑΚΟΛΟΥΘΗΣΕΙ, όχι να ξαναγεννηθεί στη θέση-άγκιστρο.
 *      Αυτό είναι όλη η διαφορά ανάμεσα σε delta-move και regenerate — και ο λόγος που το
 *      regenerate εδώ θα ήταν καταστροφή δεδομένων.
 *   2. **Idempotency.** Ίδια σφραγίδα ⇒ ΤΟ ΙΔΙΟ αντικείμενο σκηνής (όχι απλώς ίσο): καμία
 *      εγγραφή, κανένα re-render, κανένα autosave.
 *   3. **Fail-closed.** Ασφράγιστη (legacy) ομάδα ⇒ ΚΑΝΕΝΑ άγγιγμα + σήμα. Με **αρνητικό
 *      μάρτυρα**: η ίδια ακριβώς σκηνή ΜΕ σφραγίδα οφείλει να μετακινηθεί — αλλιώς ο έλεγχος
 *      θα ήταν πράσινος και για έναν reconciler που δεν κάνει τίποτα ποτέ.
 */

import { reconcileBakedFramesInScene } from '../persistence/topo-frame-reconcile';
import type { TopoLevelBakedFrames } from '../topo-baked-frame-store';
import { TOPO_GRID_LAYER_NAME } from '../topo-grid-config';
import { TOPO_NORTH_LAYER_NAME } from '../north-arrow-config';
import { TOPO_POINT_ELEV_LAYER_NAME } from '../topo-point-label-config';
import { createSceneLayer } from '../../../types/scene-types';
import { geoReferenceOfStamp, type ProjectFrameStamp } from '../../geo-referencing/project-frame';
import { makeWorldToDisplayProjector } from '../../geo-referencing/geo-transform';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import type { Point2D } from '../../../rendering/types/Types';

const FRAME_OLD: ProjectFrameStamp = {
  originWorldXMm: 407_565_290, originWorldYMm: 4_502_055_670, rotationDeg: 0,
};
const FRAME_NEW: ProjectFrameStamp = {
  originWorldXMm: 407_600_000, originWorldYMm: 4_502_100_000, rotationDeg: 0,
};
const FRAME_NEW_ROTATED: ProjectFrameStamp = { ...FRAME_NEW, rotationDeg: 17.5 };

const gridLayer = createSceneLayer({ name: TOPO_GRID_LAYER_NAME, color: '#5B6B7B', visible: true, locked: false });
const northLayer = createSceneLayer({ name: TOPO_NORTH_LAYER_NAME, color: '#1A1A1A', visible: true, locked: false });
const elevLayer = createSceneLayer({ name: TOPO_POINT_ELEV_LAYER_NAME, color: '#1A1A1A', visible: true, locked: false });
const otherLayer = createSceneLayer({ name: 'A-WALL', color: '#000000', visible: true, locked: false });

function makeScene(entities: AnySceneEntity[]): SceneModel {
  const layers = [gridLayer, northLayer, elevLayer, otherLayer];
  const layersById: Record<string, ReturnType<typeof createSceneLayer>> = {};
  for (const l of layers) layersById[l.id] = l;
  return {
    entities,
    layersById: layersById as unknown as SceneModel['layersById'],
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as SceneModel;
}

const line = (id: string, layerId: string, start: Point2D, end: Point2D): AnySceneEntity =>
  ({ id, type: 'line', layerId, start, end }) as unknown as AnySceneEntity;

const text = (id: string, layerId: string, position: Point2D, rotation?: number): AnySceneEntity =>
  ({ id, type: 'text', layerId, position, text: '407650', fontSize: 100, ...(rotation === undefined ? {} : { rotation }) }) as unknown as AnySceneEntity;

const polyline = (id: string, layerId: string, vertices: Point2D[]): AnySceneEntity =>
  ({ id, type: 'lwpolyline', layerId, vertices, closed: true }) as unknown as AnySceneEntity;

const stamped = (frames: TopoLevelBakedFrames): TopoLevelBakedFrames => frames;

/** Πού κάθεται ένα ΕΓΣΑ σημείο μέσα σε ένα πλαίσιο (η «σωστή απάντηση» κάθε ελέγχου). */
const displayOf = (world: Point2D, frame: ProjectFrameStamp): Point2D =>
  makeWorldToDisplayProjector(geoReferenceOfStamp(frame)).project(world.x, world.y);

describe('ADR-650 §M10g — ο μετακινημένος βορράς ΑΚΟΛΟΥΘΕΙ (delta-move, όχι regenerate)', () => {
  // Ο βορράς ψήθηκε πάνω από αυτό το ΕΓΣΑ σημείο, και μετά ο χρήστης τον έσυρε 250 m δεξιά
  // και 120 m κάτω — στη γωνιά του φύλλου, όπως κάνει κάθε τοπογράφος.
  const ANCHOR_WORLD: Point2D = { x: 407_723_104, y: 4_502_396_120 };
  const USER_DRAG: Point2D = { x: 250_000, y: -120_000 };

  const bakedAt = displayOf(ANCHOR_WORLD, FRAME_OLD);
  const userPlaced: Point2D = { x: bakedAt.x + USER_DRAG.x, y: bakedAt.y + USER_DRAG.y };

  it('η ΣΧΕΤΙΚΗ θέση που έδωσε ο χρήστης διατηρείται στο νέο πλαίσιο', () => {
    const scene = makeScene([
      polyline('north_outline', northLayer.id, [
        userPlaced,
        { x: userPlaced.x + 3000, y: userPlaced.y },
        { x: userPlaced.x, y: userPlaced.y + 6000 },
      ]),
    ]);

    const result = reconcileBakedFramesInScene({
      scene,
      currentFrame: FRAME_NEW,
      bakedFrames: stamped({ north: FRAME_OLD }),
    });

    const moved = result.scene.entities[0] as unknown as { vertices: Point2D[] };
    const expectedAnchor = displayOf(ANCHOR_WORLD, FRAME_NEW);
    expect(moved.vertices[0].x).toBeCloseTo(expectedAnchor.x + USER_DRAG.x, 3);
    expect(moved.vertices[0].y).toBeCloseTo(expectedAnchor.y + USER_DRAG.y, 3);
    expect(result.movedByGroup.north).toBe(1);
    expect(result.nextBakedFrames.north).toEqual(FRAME_NEW);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ένα regenerate θα τον ξανάβαζε στο άγκιστρο, χάνοντας το σύρσιμο', () => {
    // Αν κάποιος αντικαταστήσει τη μετακίνηση με αναπαραγωγή, η κορυφή θα κάθεται ΣΤΟ άγκιστρο
    // του νέου πλαισίου — δηλαδή θα ΜΗΝ κουβαλά πια το σύρσιμο του χρήστη.
    const scene = makeScene([polyline('north_outline', northLayer.id, [userPlaced])]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({ north: FRAME_OLD }),
    });
    const moved = (result.scene.entities[0] as unknown as { vertices: Point2D[] }).vertices[0];
    const anchorOnly = displayOf(ANCHOR_WORLD, FRAME_NEW);
    expect(Math.hypot(moved.x - anchorOnly.x, moved.y - anchorOnly.y))
      .toBeCloseTo(Math.hypot(USER_DRAG.x, USER_DRAG.y), 3);
  });
});

describe('ADR-650 §M10g — idempotency: ίδια σφραγίδα ⇒ ΚΑΜΙΑ εγγραφή', () => {
  it('ίδιο πλαίσιο ⇒ επιστρέφεται ΤΟ ΙΔΙΟ αντικείμενο σκηνής (όχι απλώς ίσο)', () => {
    const scene = makeScene([line('g1', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 })]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_OLD, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    expect(result.scene).toBe(scene);
    expect(result.movedByGroup).toEqual({});
    expect(result.nextBakedFrames.grid).toEqual(FRAME_OLD);
  });

  it('δεύτερο πέρασμα μετά από μετακίνηση είναι no-op (delta, όχι απόλυτη τιμή)', () => {
    const scene = makeScene([line('g1', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 })]);
    const first = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    const second = reconcileBakedFramesInScene({
      scene: first.scene, currentFrame: FRAME_NEW, bakedFrames: first.nextBakedFrames,
    });
    expect(second.scene).toBe(first.scene);
    expect(second.movedByGroup).toEqual({});
  });
});

describe('ADR-650 §M10g — fail-closed: άγνωστο πλαίσιο ⇒ κανένα άγγιγμα', () => {
  const gridEntity = () => line('g1', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 });

  it('legacy (χωρίς σφραγίδα) ⇒ η σκηνή μένει ΑΚΡΙΒΩΣ η ίδια + σημαδεύεται', () => {
    const scene = makeScene([gridEntity()]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({}),
    });
    expect(result.scene).toBe(scene);
    expect(result.unstampedGroups).toEqual(['grid']);
    expect(result.nextBakedFrames.grid).toBeUndefined(); // ΔΕΝ «σφραγίζουμε εκ των υστέρων»
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: η ΙΔΙΑ σκηνή ΜΕ σφραγίδα όντως μετακινείται', () => {
    const scene = makeScene([gridEntity()]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    expect(result.scene).not.toBe(scene);
    expect(result.movedByGroup.grid).toBe(1);
    expect(result.unstampedGroups).toEqual([]);
  });

  it('τύπος εκτός του SSoT της στροφής ⇒ ΟΛΗ η ομάδα μένει ακέραιη (όχι μισή μετακίνηση)', () => {
    const exotic = { id: 'x1', type: 'point', layerId: gridLayer.id, position: { x: 5, y: 5 } } as unknown as AnySceneEntity;
    const scene = makeScene([gridEntity(), exotic]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW_ROTATED, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    expect(result.scene).toBe(scene);
    expect(result.unsupportedGroups).toEqual(['grid']);
    // Η ΠΑΛΙΑ σφραγίδα διατηρείται: το επόμενο πέρασμα (μετά από διόρθωση) ξαναδοκιμάζει.
    expect(result.nextBakedFrames.grid).toEqual(FRAME_OLD);
  });
});

describe('ADR-650 §M10g — ο προσανατολισμός των glyphs δηλώνεται, δεν μαντεύεται', () => {
  it('ομάδα ΧΑΡΤΙΟΥ: η ετικέτα καννάβου μετακινείται αλλά ΔΕΝ στρίβει (§M10f κανόνας 3)', () => {
    const scene = makeScene([text('grid_label', gridLayer.id, { x: 1000, y: 2000 })]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW_ROTATED, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    const moved = result.scene.entities[0] as unknown as { position: Point2D; rotation?: number };
    expect(moved.position.x).not.toBeCloseTo(1000, 3); // όντως μετακινήθηκε
    expect(moved.rotation).toBeUndefined();            // …αλλά διαβάζεται ακόμη οριζόντια
  });

  it('ομάδα ΧΑΡΤΙΟΥ με υπάρχουσα γωνία: διατηρείται ΑΚΡΙΒΩΣ όπως την άφησε ο χρήστης', () => {
    const scene = makeScene([text('lbl', elevLayer.id, { x: 500, y: 500 }, 12)]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW_ROTATED, bakedFrames: stamped({ pointLabels: FRAME_OLD }),
    });
    expect((result.scene.entities[0] as unknown as { rotation?: number }).rotation).toBe(12);
  });

  it('ομάδα ΚΟΣΜΟΥ: το «Β» του βορρά στρίβει μαζί με το πλαίσιο (αλλιώς λέει ψέματα)', () => {
    const scene = makeScene([text('north_glyph', northLayer.id, { x: 500, y: 500 }, 0)]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW_ROTATED, bakedFrames: stamped({ north: FRAME_OLD }),
    });
    const rotation = (result.scene.entities[0] as unknown as { rotation: number }).rotation;
    // delta = old.rotation − new.rotation = 0 − 17,5 = −17,5 ⇒ κανονικοποιημένο 342,5.
    expect(rotation).toBeCloseTo(342.5, 6);
  });
});

describe('ADR-650 §M10g — το πέρασμα δεν ακουμπά τίποτα άλλο', () => {
  it('οντότητες εκτός των δηλωμένων layers μένουν ΑΝΕΠΑΦΕΣ (ίδια αναφορά)', () => {
    const wall = line('w1', otherLayer.id, { x: 0, y: 0 }, { x: 5000, y: 0 });
    const scene = makeScene([wall, line('g1', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 })]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    expect(result.scene.entities[0]).toBe(wall);
    expect(result.scene.entities[1]).not.toBe(scene.entities[1]);
  });

  it('η σειρά του πίνακα (z-order, ADR-661) διατηρείται', () => {
    const scene = makeScene([
      line('a', otherLayer.id, { x: 0, y: 0 }, { x: 1, y: 1 }),
      line('b', gridLayer.id, { x: 0, y: 0 }, { x: 1, y: 1 }),
      line('c', otherLayer.id, { x: 0, y: 0 }, { x: 1, y: 1 }),
    ]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({ grid: FRAME_OLD }),
    });
    expect(result.scene.entities.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('σφραγίδα ομάδας που ο χρήστης άδειασε αποσύρεται (δεν λιμνάζει)', () => {
    const scene = makeScene([]);
    const result = reconcileBakedFramesInScene({
      scene, currentFrame: FRAME_NEW, bakedFrames: stamped({ grid: FRAME_OLD, north: FRAME_OLD }),
    });
    expect(result.nextBakedFrames).toEqual({});
  });
});
