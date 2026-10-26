/**
 * ADR-920 Β4.8 Β3.1 · ADR-650 §M10f — το topo σύνορο του «Zoom To».
 *
 * Το συμβόλαιο που ΚΑΝΕΝΑ test δεν έλεγχε πριν: το κουτί που φτάνει στον 2Δ καμβά είναι σε **DISPLAY**
 * (τοπικά mm του σχεδίου), όχι σε ΕΓΣΑ. Σε μη-γεωαναφερμένο έργο τα δύο ταυτίζονται — γι' αυτό το κενό
 * επιβίωσε πράσινο. Τα tests εδώ τρέχουν σε ΠΡΑΓΜΑΤΙΚΗ γεωαναφορά (origin του οικοπέδου της υπόθεσης,
 * και στραμμένη) και ρωτούν: πού πάει η όψη, και πού ρωτά ο 3Δ resolver για υψόμετρο.
 */

import { focusTopoReviewTarget, topoReviewFocusFrame } from '../topo-review-focus';
import { reviewFocusExtent } from '../../coordination/review-focus';
import { subscribeViewFocus, type ViewFocusRequest } from '../../coordination/view-focus-bus';
import { EventBus } from '../../events';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { makeWorldToDisplayProjector } from '../../geo-referencing/geo-transform';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import { SCENE_COORD_BAND_MM } from '../../../config/geometry-constants';
import type { Point2D } from '../../../rendering/types/Types';
import type { WorldTriple } from '../../../bim-3d/viewport/plan-to-world-math';

// Το οικόπεδο της υπόθεσης (ίδιο με το `topo-display-frame.test`): ΕΓΣΑ σε mm, ~4·10⁸.
const ORIGIN_WORLD = { x: 407_565_290, y: 4_502_055_670 };
const GEO = { originWorld: ORIGIN_WORLD, rotationDeg: 0 };
const GEO_ROTATED = { originWorld: ORIGIN_WORLD, rotationDeg: 17.5 };
const FLAG_WORLD: Point2D = { x: ORIGIN_WORLD.x + 12_000, y: ORIGIN_WORLD.y + 8_000 };
const PAD_MM = 15_000;
const WORLD: WorldTriple = { x: 1, y: 2, z: 3 };

function inSceneBand(p: Point2D): boolean {
  return Math.abs(p.x) < SCENE_COORD_BAND_MM && Math.abs(p.y) < SCENE_COORD_BAND_MM;
}

describe('topoReviewFocusFrame (pure)', () => {
  it('non-geo-referenced → byte-identical to the plain extent (nothing changes for local projects)', () => {
    const frame = topoReviewFocusFrame([{ x: 1000, y: 2000 }], PAD_MM, null)!;
    expect(frame.extent).toEqual(reviewFocusExtent([{ x: 1000, y: 2000 }], PAD_MM));
    expect(frame.worldCentre).toEqual({ x: 1000, y: 2000 });
  });

  it('geo-referenced → the 2D box is DISPLAY (inside the scene band), never ΕΓΣΑ', () => {
    const projector = makeWorldToDisplayProjector(GEO);
    const frame = topoReviewFocusFrame([FLAG_WORLD], PAD_MM, projector)!;
    // Το σφάλμα: το κουτί ζούσε στα ~4·10⁸ mm — έξω από τη ζώνη της σκηνής, ο καμβάς πήγαινε στο κενό.
    expect(inSceneBand(frame.extent.centre)).toBe(true);
    expect(frame.extent.centre.x).toBeCloseTo(projector.project(FLAG_WORLD.x, FLAG_WORLD.y).x, 6);
    expect(frame.extent.centre.y).toBeCloseTo(projector.project(FLAG_WORLD.x, FLAG_WORLD.y).y, 6);
  });

  it('the 3D resolver gets the WORLD centre back — exactly the finding, where the TIN lives', () => {
    const frame = topoReviewFocusFrame([FLAG_WORLD], PAD_MM, makeWorldToDisplayProjector(GEO_ROTATED))!;
    expect(frame.worldCentre.x).toBeCloseTo(FLAG_WORLD.x, 3);
    expect(frame.worldCentre.y).toBeCloseTo(FLAG_WORLD.y, 3);
  });

  it('a rotated project frames the chain by its DISPLAY box (what the screen and the 3D scene show)', () => {
    const projector = makeWorldToDisplayProjector(GEO_ROTATED);
    const chain = [FLAG_WORLD, { x: FLAG_WORLD.x + 100_000, y: FLAG_WORLD.y }];
    const frame = topoReviewFocusFrame(chain, 5_000, projector)!;
    expect(frame.extent).toEqual(reviewFocusExtent(chain.map((p) => projector.project(p.x, p.y)), 5_000));
  });

  it('nothing finite → null (the caller moves nothing)', () => {
    expect(topoReviewFocusFrame([{ x: Number.NaN, y: 0 }], PAD_MM, makeWorldToDisplayProjector(GEO))).toBeNull();
  });
});

describe('focusTopoReviewTarget — reads the ACTIVE geo-reference', () => {
  let fits: Array<{ bounds: { min: Point2D; max: Point2D } }>;
  let focusRequests: ViewFocusRequest[];
  let unsubscribes: Array<() => void>;

  beforeEach(() => {
    fits = [];
    focusRequests = [];
    unsubscribes = [
      EventBus.on('canvas-fit-to-view-selected', (p) => fits.push(p)),
      subscribeViewFocus((r) => focusRequests.push(r)),
    ];
    useViewMode3DStore.setState({ mode: '2d' });
    setGeoReference(GEO);
  });

  afterEach(() => {
    unsubscribes.forEach((off) => off());
    useViewMode3DStore.setState({ mode: '2d' });
    setGeoReference(null);
  });

  it('2D: the canvas is asked to fit a DISPLAY box around the projected finding', () => {
    expect(focusTopoReviewTarget([FLAG_WORLD], PAD_MM, () => WORLD, false)).toBe(true);
    expect(fits).toHaveLength(1);
    const { min, max } = fits[0]!.bounds;
    expect(inSceneBand(min) && inSceneBand(max)).toBe(true);
  });

  it('3D: the resolver is called with the WORLD centre and the camera request carries its answer', () => {
    useViewMode3DStore.setState({ mode: '3d-raster' });
    const resolve = jest.fn((_centre: Point2D) => WORLD);
    focusTopoReviewTarget([FLAG_WORLD], PAD_MM, resolve, true);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]![0].x).toBeCloseTo(FLAG_WORLD.x, 3);
    expect(resolve.mock.calls[0]![0].y).toBeCloseTo(FLAG_WORLD.y, 3);
    expect(focusRequests).toEqual([{ point: WORLD, halfExtentM: 15, preserveZoom: true }]);
    expect(fits).toHaveLength(0);
  });

  it('non-finite finding → false, and nothing moves', () => {
    expect(focusTopoReviewTarget([{ x: Number.NaN, y: Number.NaN }], PAD_MM, () => WORLD, false)).toBe(false);
    expect(fits).toHaveLength(0);
    expect(focusRequests).toHaveLength(0);
  });
});
