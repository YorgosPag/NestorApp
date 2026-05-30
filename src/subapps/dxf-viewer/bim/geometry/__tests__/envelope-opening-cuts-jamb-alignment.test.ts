/**
 * ADR-396/363 — Z1 cut ↔ wall punch ↔ Z4 jamb ΕΥΘΥΓΡΑΜΜΙΣΗ (collinear παρειές).
 *
 * Root cause (διαγνωστικό → permanent regression):
 *   - Wall punch + Z4 reveal ορίζουν την παρειά από το `opening.geometry.outline`
 *     (κάθετη τομή στις ΠΡΑΓΜΑΤΙΚΕΣ ακμές τοίχου).
 *   - Z1 cut (`computeEnvelopeOpeningCuts`) όριζε το `[tStart,tEnd]` προβάλλοντας τα
 *     **midpoints του άξονα** (εσωτερικά σημεία) στην πλησιέστερη ακμή του exterior
 *     face loop. Σε **λοξό/mitered** face η προβολή ενός εσωτερικού σημείου σε λοξή
 *     ακμή μετατοπίζεται πλευρικά → το Z1 boundary πέφτει σε άλλη αξονική θέση από
 *     την παρειά τοίχου/Z4 (BUG B· και μέσω του reveal-wrap → BUG A).
 *
 * Σωστή συμπεριφορά: το Z1 cut boundary πρέπει να περνά ΑΠΟ τις **exterior-face
 * γωνίες του ίδιου outline** (που κείτονται πάνω στο face loop) → `lerp(face, t)`
 * ίσο με την εξωτερική γωνία → collinear με wall punch + Z4 σε ΟΛΑ τα faces.
 */

import {
  computeEnvelopeOpeningCuts,
  type OpeningForCut,
} from '../envelope-opening-cuts';
import { computeRevealJambQuads } from '../reveal-lining-geometry';
import type { EnvelopeChain } from '../envelope-perimeter';

function pt(x: number, y: number) {
  return { x, y, z: 0 };
}

/**
 * Chain με **λοξή** κάτω εξωτ. ακμή A=(0,-100)→B=(5000,900) (κλίση 0.2). Οι άλλες
 * ακμές απλώς κλείνουν το loop. Outer loop = 1:1 (ίδιο count) shift (0,-300) προς
 * τα έξω — οι F-side ισχυρισμοί εξαρτώνται μόνο από το face.
 */
function slantedBottomChain(wallIds: string[]): EnvelopeChain {
  const face = [pt(0, -100), pt(5000, 900), pt(5000, 5000), pt(0, 5000), pt(0, -100)];
  const outer = face.map((p) => pt(p.x, p.y - 300));
  return {
    exteriorFaceLoop: { points: face, closed: true },
    insulationOuterLoop: { points: outer, closed: true },
    closed: true,
    enclosesRegion: true,
    perimeterM: 24,
    wallIds,
    columnIds: [],
  };
}

/**
 * Παράθυρο με ΚΑΘΕΤΕΣ παρειές (vertical jambs x=2000, x=3000) πάνω στη λοξή ακμή.
 * Εξωτερικές γωνίες (πάνω στην AB): (2000,300),(3000,500). Εσωτερικές +1000 σε y.
 * Outline CCW: [start-ext, end-ext, end-int, start-int].
 */
function windowOnSlantedEdge(wallId: string): OpeningForCut {
  return {
    params: { wallId, width: 1000, sillHeight: 900, height: 1400 },
    geometry: {
      outline: {
        vertices: [pt(2000, 300), pt(3000, 500), pt(3000, 1500), pt(2000, 1300)],
      },
    },
  };
}

// y πάνω στην ακμή A→B στο δοσμένο x (κλίση 0.2).
const yOnAB = (x: number) => -100 + (x / 5000) * 1000;

describe('Z1 cut boundary ευθυγραμμίζεται με τις exterior-face γωνίες του outline (λοξό face)', () => {
  it('lerp(face, tStart/tEnd) πέφτει ΠΑΝΩ στις εξωτερικές γωνίες (2000,300)/(3000,500)', () => {
    const chain = slantedBottomChain(['w1']);
    const cuts = computeEnvelopeOpeningCuts(chain, [windowOnSlantedEdge('w1')], 'mm');

    expect(cuts).toHaveLength(1);
    expect(cuts[0].edgeIndex).toBe(0);

    const q = cuts[0].bandQuad; // [O_a, O_b, F_b, F_a]
    const Fa = q[3]; // face στο tStart
    const Fb = q[2]; // face στο tEnd
    // Πρέπει να ταυτίζονται με τις ΚΑΘΕΤΕΣ παρειές του outline (x=2000 / x=3000),
    // ΟΧΙ με την πλευρική μετατόπιση από την προβολή του axis-midpoint.
    expect(Fa.x).toBeCloseTo(2000, 3);
    expect(Fa.y).toBeCloseTo(yOnAB(2000), 3); // 300
    expect(Fb.x).toBeCloseTo(3000, 3);
    expect(Fb.y).toBeCloseTo(yOnAB(3000), 3); // 500
  });

  it('control — σε ΕΥΘΥ (horizontal) face οι δύο μέθοδοι συμπίπτουν (μη-regression)', () => {
    // Επαναχρησιμοποιεί τη λογική: ευθύ face y=0, κάθετες παρειές → t 0.4/0.6.
    const face = [pt(0, 0), pt(5000, 0), pt(5000, 5000), pt(0, 5000), pt(0, 0)];
    const outer = face.map((p) => pt(p.x, p.y - 100));
    const chain: EnvelopeChain = {
      exteriorFaceLoop: { points: face, closed: true },
      insulationOuterLoop: { points: outer, closed: true },
      closed: true,
      enclosesRegion: true,
      perimeterM: 20,
      wallIds: ['w1'],
      columnIds: [],
    };
    const win: OpeningForCut = {
      params: { wallId: 'w1', width: 1000, sillHeight: 900, height: 1400 },
      geometry: {
        outline: { vertices: [pt(2000, 0), pt(3000, 0), pt(3000, 200), pt(2000, 200)] },
      },
    };
    const cuts = computeEnvelopeOpeningCuts(chain, [win], 'mm');
    expect(cuts[0].tStart).toBeCloseTo(0.4, 5);
    expect(cuts[0].tEnd).toBeCloseTo(0.6, 5);
  });
});

describe('Z4 reveal ⟷ wall punch: η back-face του περβαζιού ΕΙΝΑΙ η παρειά του outline', () => {
  // Wall punch + Z4 μοιράζονται το ΙΔΙΟ outline· η back-face του Z4 strip = η ακμή
  // jamb του outline (v0-v3 / v1-v2). Άρα είναι ΠΑΝΤΑ flush — το «σκέλος» του BUG A
  // (κενό/επικάλυψη wall↔Z4) δεν προέρχεται από απόκλιση εδώ, αλλά από την
  // αλληλεπίδραση Z1↔Z4 (που διορθώνει το Z1 cut fix). Κανένα change στο reveal-lining.
  it('startJamb/endJamb back-face == outline jamb edges (λοξό face)', () => {
    const outline = windowOnSlantedEdge('w1').geometry!.outline!.vertices;
    const jambs = computeRevealJambQuads(outline, 50)!;
    expect(jambs).not.toBeNull();
    // startJamb = [v0, v3, along(v3), along(v0)] → πρώτη ακμή v0→v3 = outline start jamb.
    expect(jambs.startJamb[0]).toMatchObject({ x: outline[0].x, y: outline[0].y });
    expect(jambs.startJamb[1]).toMatchObject({ x: outline[3].x, y: outline[3].y });
    // endJamb = [v1, v2, ...] → πρώτη ακμή v1→v2 = outline end jamb.
    expect(jambs.endJamb[0]).toMatchObject({ x: outline[1].x, y: outline[1].y });
    expect(jambs.endJamb[1]).toMatchObject({ x: outline[2].x, y: outline[2].y });
  });
});
