/**
 * ADR-396 — `computeEnvelopeOpeningCuts` SSoT tests.
 *
 * Επαληθεύει την αντιστοίχιση ανοιγμάτων στο exterior face loop: projection σε
 * ακμή, span [tStart,tEnd], sill/head (mm → m) και φιλτράρισμα κατά wallId.
 */

import {
  computeEnvelopeOpeningCuts,
  type OpeningForCut,
} from '../envelope-opening-cuts';
import type { EnvelopeChain } from '../envelope-perimeter';

// Τετράγωνο κτίριο 5000×5000 (mm = canvas, sceneUnits 'mm' → s=1). Face loop CCW
// με closing duplicate· outer loop = 1:1 offset 100 προς τα έξω.
function squareChain(wallIds: string[]): EnvelopeChain {
  const face = [
    { x: 0, y: 0, z: 0 },
    { x: 5000, y: 0, z: 0 },
    { x: 5000, y: 5000, z: 0 },
    { x: 0, y: 5000, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  const outer = [
    { x: -100, y: -100, z: 0 },
    { x: 5100, y: -100, z: 0 },
    { x: 5100, y: 5100, z: 0 },
    { x: -100, y: 5100, z: 0 },
    { x: -100, y: -100, z: 0 },
  ];
  return {
    exteriorFaceLoop: { points: face, closed: true },
    insulationOuterLoop: { points: outer, closed: true },
    closed: true,
    perimeterM: 20,
    wallIds,
    columnIds: [],
  };
}

/**
 * Παράθυρο στο μέσο της κάτω ακμής (y=0), πλάτος 1000, ποδιά 900, ύψος 1400.
 * `outline` = canvas-unit ορθογώνιο (center 2500, πλάτος 1000, πάχος 200) — ΙΔΙΟΣ
 * χώρος με το face loop (primary path του `computeEnvelopeOpeningCuts`).
 */
function windowOnBottomEdge(wallId: string): OpeningForCut {
  return {
    params: { wallId, width: 1000, sillHeight: 900, height: 1400 },
    geometry: {
      position: { x: 2500, y: 0, z: 0 },
      rotation: 0, // κατά μήκος +x
      outline: {
        vertices: [
          { x: 2000, y: -100, z: 0 }, // start-outer
          { x: 3000, y: -100, z: 0 }, // end-outer
          { x: 3000, y: 100, z: 0 },  // end-inner
          { x: 2000, y: 100, z: 0 },  // start-inner
        ],
      },
    },
  };
}

describe('computeEnvelopeOpeningCuts', () => {
  it('αντιστοιχίζει παράθυρο στη σωστή ακμή με span [0.4, 0.6]', () => {
    const chain = squareChain(['w1', 'w2', 'w3', 'w4']);
    const cuts = computeEnvelopeOpeningCuts(chain, [windowOnBottomEdge('w1')], 'mm');

    expect(cuts).toHaveLength(1);
    expect(cuts[0].edgeIndex).toBe(0);
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
  });

  it('μετατρέπει sill/head mm → ΜΕΤΡΑ', () => {
    const chain = squareChain(['w1']);
    const cuts = computeEnvelopeOpeningCuts(chain, [windowOnBottomEdge('w1')], 'mm');

    expect(cuts[0].sillM).toBeCloseTo(0.9, 5);
    expect(cuts[0].headM).toBeCloseTo(2.3, 5); // (900 + 1400) / 1000
  });

  it('πόρτα (sill 0) → sillM 0', () => {
    const chain = squareChain(['w1']);
    const door: OpeningForCut = {
      params: { wallId: 'w1', width: 900, sillHeight: 0, height: 2100 },
      geometry: { position: { x: 2500, y: 0, z: 0 }, rotation: 0 },
    };
    const cuts = computeEnvelopeOpeningCuts(chain, [door], 'mm');

    expect(cuts).toHaveLength(1);
    expect(cuts[0].sillM).toBe(0);
    expect(cuts[0].headM).toBeCloseTo(2.1, 5);
  });

  it('band sub-quad = [O_a, O_b, F_b, F_a] (outer fwd → inner reversed)', () => {
    const chain = squareChain(['w1']);
    const cuts = computeEnvelopeOpeningCuts(chain, [windowOnBottomEdge('w1')], 'mm');
    const q = cuts[0].bandQuad;

    expect(q).toHaveLength(4);
    // F_a = lerp((0,0)->(5000,0), 0.4) = (2000, 0)· F_b = (3000, 0).
    expect(q[3]).toMatchObject({ x: 2000, y: 0 }); // F_a
    expect(q[2]).toMatchObject({ x: 3000, y: 0 }); // F_b
    // O_a = lerp((-100,-100)->(5100,-100), 0.4) = (1980, -100)· O_b = (3020, -100).
    expect(q[0]).toMatchObject({ x: 1980, y: -100 }); // O_a
    expect(q[1]).toMatchObject({ x: 3020, y: -100 }); // O_b
  });

  it('reveal ΔΕΝ επηρεάζει το Z1 cut (ADR-396: η μόνωση τρώει τον τοίχο, όχι το άνοιγμα)', () => {
    // Το παλιό "reveal wrap" αφαιρέθηκε. Το Z1 cut = το ελεύθερο άνοιγμα (το outline
    // εδώ είναι free)· η Z4 ring γεμίζει το structural δαχτυλίδι εμπρός (collinear).
    const chain = squareChain(['w1']);
    const win = windowOnBottomEdge('w1');
    const withReveal: OpeningForCut = {
      ...win,
      params: { ...win.params, revealInsulation: { thickness_m: 0.05 } },
    };
    const cuts = computeEnvelopeOpeningCuts(chain, [withReveal], 'mm');
    expect(cuts).toHaveLength(1);
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
  });

  it('χωρίς reveal → span αμετάβλητο (regression)', () => {
    const chain = squareChain(['w1']);
    const cuts = computeEnvelopeOpeningCuts(chain, [windowOnBottomEdge('w1')], 'mm');
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
  });

  it('μεγάλο reveal → το Z1 cut ΠΑΡΑΜΕΝΕΙ στο free (δεν γίνεται πλέον skip)', () => {
    const chain = squareChain(['w1']);
    const win = windowOnBottomEdge('w1');
    const huge: OpeningForCut = {
      ...win,
      params: { ...win.params, revealInsulation: { thickness_m: 0.6 } },
    };
    const cuts = computeEnvelopeOpeningCuts(chain, [huge], 'mm');
    expect(cuts).toHaveLength(1);
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
  });

  it('αγνοεί ανοίγματα τοίχων εκτός chain', () => {
    const chain = squareChain(['w1', 'w2']);
    const cuts = computeEnvelopeOpeningCuts(chain, [windowOnBottomEdge('w99')], 'mm');
    expect(cuts).toHaveLength(0);
  });

  it('αγνοεί ανοίγματα χωρίς geometry (position/rotation/outline)', () => {
    const chain = squareChain(['w1']);
    const noGeom: OpeningForCut = {
      params: { wallId: 'w1', width: 1000, sillHeight: 900, height: 1400 },
    };
    const cuts = computeEnvelopeOpeningCuts(chain, [noGeom], 'mm');
    expect(cuts).toHaveLength(0);
  });

  it('επιστρέφει κενό όταν τα loops δεν είναι 1:1', () => {
    const chain = squareChain(['w1']);
    const broken: EnvelopeChain = {
      ...chain,
      insulationOuterLoop: { points: chain.insulationOuterLoop.points.slice(0, 3), closed: true },
    };
    const cuts = computeEnvelopeOpeningCuts(broken, [windowOnBottomEdge('w1')], 'mm');
    expect(cuts).toHaveLength(0);
  });

  it('fallback σε position+rotation όταν λείπει outline (width mm → canvas)', () => {
    const chain = squareChain(['w1']);
    const viaPosition: OpeningForCut = {
      params: { wallId: 'w1', width: 1000, sillHeight: 900, height: 1400 },
      geometry: { position: { x: 2500, y: 0, z: 0 }, rotation: 0 },
    };
    const cuts = computeEnvelopeOpeningCuts(chain, [viaPosition], 'mm');

    expect(cuts).toHaveLength(1);
    expect(cuts[0].edgeIndex).toBe(0);
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
  });

  it('unit-independent: σκηνή σε ΜΕΤΡΑ — outline (canvas=m) χωρίς λάθος κλιμάκωση', () => {
    // Το geometry του ανοίγματος ζει σε scene units (canvas) — ΟΧΙ mm. Για 'm'
    // σκηνή το παλιό `× mmToSceneUnits` έσπαγε (×0.001 → άνοιγμα στο origin).
    const chainM: EnvelopeChain = {
      exteriorFaceLoop: {
        points: [pt0(0, 0), pt0(5, 0), pt0(5, 5), pt0(0, 5), pt0(0, 0)],
        closed: true,
      },
      insulationOuterLoop: {
        points: [pt0(-0.1, -0.1), pt0(5.1, -0.1), pt0(5.1, 5.1), pt0(-0.1, 5.1), pt0(-0.1, -0.1)],
        closed: true,
      },
      closed: true,
      perimeterM: 20,
      wallIds: ['w1'],
      columnIds: [],
    };
    const windowM: OpeningForCut = {
      params: { wallId: 'w1', width: 1000, sillHeight: 900, height: 1400 },
      geometry: {
        outline: {
          vertices: [pt0(2, -0.1), pt0(3, -0.1), pt0(3, 0.1), pt0(2, 0.1)],
        },
      },
    };
    const cuts = computeEnvelopeOpeningCuts(chainM, [windowM], 'm');

    expect(cuts).toHaveLength(1);
    expect(cuts[0].edgeIndex).toBe(0);
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
    expect(cuts[0].sillM).toBeCloseTo(0.9, 5); // params πάντα mm → m
  });
});

function pt0(x: number, y: number) {
  return { x, y, z: 0 };
}
