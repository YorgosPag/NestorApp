/**
 * ADR-458 — `beam-column-cutback` pure SSoT tests.
 *
 * Επαληθεύει: corner-cut → 1 κοίλο κομμάτι, through-cut → 2 κομμάτια, no-overlap →
 * identity (null), full-consume → [], net area μετά την αφαίρεση (column wins).
 */

import {
  computeBeamCutbackOutline,
  computeBeamCutbackNetAreaM2,
  computeBeamAxisToColumnContact,
  extendBeamOutlineIntoFramingColumns,
} from '../beam-column-cutback';
import type { Pt2 } from '../shared/segment-polygon-coverage';
import type { Point3D } from '../../types/bim-base';

/** Pt2[] → Point3D[] (z=0) — column footprints δίνονται ως Point3D στον caller. */
const fp = (pts: Pt2[]): Point3D[] => pts.map((p) => ({ x: p.x, y: p.y, z: 0 }));

/** Δοκάρι 1000×250 (x∈[0,1000], y∈[0,250]), CCW. */
const BEAM: Pt2[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 250 },
  { x: 0, y: 250 },
];
const BEAM_AREA = 1000 * 250; // 250000

/** Άθροισμα εμβαδών (shoelace) όλων των κομματιών. */
function totalArea(pieces: Pt2[][]): number {
  let total = 0;
  for (const ring of pieces) {
    let twice = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      twice += a.x * b.y - b.x * a.y;
    }
    total += Math.abs(twice) / 2;
  }
  return total;
}

describe('computeBeamCutbackOutline (ADR-458)', () => {
  it('γωνιακή κοπή → 1 κοίλο κομμάτι, μειωμένο εμβαδόν', () => {
    // Κολόνα στη ΝΔ γωνία: καλύπτει x∈[0,100], y∈[0,100] του δοκαριού (10000 units²).
    const column: Pt2[] = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    const pieces = computeBeamCutbackOutline(BEAM, [column]);
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(1);
    expect(totalArea(pieces!)).toBeCloseTo(BEAM_AREA - 100 * 100, 0);
  });

  it('διαμπερής κοπή στο μέσο → 2 κομμάτια', () => {
    // Κολόνα που καλύπτει όλο το πλάτος στο μέσο (x∈[400,600]) → χωρίζει το δοκάρι.
    const column: Pt2[] = [
      { x: 400, y: -50 },
      { x: 600, y: -50 },
      { x: 600, y: 300 },
      { x: 400, y: 300 },
    ];
    const pieces = computeBeamCutbackOutline(BEAM, [column]);
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(2);
    expect(totalArea(pieces!)).toBeCloseTo(BEAM_AREA - 200 * 250, 0);
  });

  it('καμία επικάλυψη (bbox μακριά) → null (identity, zero regression)', () => {
    const column: Pt2[] = [
      { x: 2000, y: 0 },
      { x: 2200, y: 0 },
      { x: 2200, y: 200 },
      { x: 2000, y: 200 },
    ];
    expect(computeBeamCutbackOutline(BEAM, [column])).toBeNull();
  });

  it('κανένα cutter / εκφυλισμένο input → null', () => {
    expect(computeBeamCutbackOutline(BEAM, [])).toBeNull();
    expect(computeBeamCutbackOutline([{ x: 0, y: 0 }], [BEAM])).toBeNull();
  });

  it('δοκάρι εξ ολοκλήρου μέσα στην κολόνα → [] (δεν σχεδιάζεται)', () => {
    const column: Pt2[] = [
      { x: -100, y: -100 },
      { x: 1100, y: -100 },
      { x: 1100, y: 350 },
      { x: -100, y: 350 },
    ];
    const pieces = computeBeamCutbackOutline(BEAM, [column]);
    expect(pieces).toEqual([]);
  });
});

describe('computeBeamCutbackNetAreaM2 (ADR-458)', () => {
  it('αφαιρεί την επικάλυψη της κολόνας (column wins), σε m²', () => {
    const column: Pt2[] = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    // canvasToM2 = 1 → επιστρέφει σε units² για ευκολία ελέγχου.
    const net = computeBeamCutbackNetAreaM2(BEAM, [column], 1);
    expect(net).not.toBeNull();
    expect(net!).toBeCloseTo(BEAM_AREA - 100 * 100, 0);
  });

  it('καμία τομή → null (ο caller κρατά το αρχικό area)', () => {
    const column: Pt2[] = [
      { x: 2000, y: 0 },
      { x: 2200, y: 0 },
      { x: 2200, y: 200 },
      { x: 2000, y: 200 },
    ];
    expect(computeBeamCutbackNetAreaM2(BEAM, [column], 1)).toBeNull();
  });
});

describe('computeBeamAxisToColumnContact (ADR-458)', () => {
  // Άξονας (centerline) του BEAM: y=125, από (0,125) έως (1000,125).
  const A_START: Pt2 = { x: 0, y: 125 };
  const A_END: Pt2 = { x: 1000, y: 125 };

  it('άκρο ΜΕΣΑ σε κολόνα → pull-back στην εσωτερική παρειά', () => {
    // Κολόνα x∈[900,1100] → το άκρο (1000,125) είναι ΜΕΣΑ· παρειά στο x=900.
    const column = fp([
      { x: 900, y: -50 },
      { x: 1100, y: -50 },
      { x: 1100, y: 300 },
      { x: 900, y: 300 },
    ]);
    const res = computeBeamAxisToColumnContact(A_START, A_END, BEAM, [column]);
    expect(res).not.toBeNull();
    expect(res![0]).toEqual(A_START); // αρχή αμετάβλητη
    expect(res![1].x).toBeCloseTo(900, 6); // τέλος → παρειά
    expect(res![1].y).toBeCloseTo(125, 6);
  });

  it('άκρο έξω, κολόνα πιο πέρα (body overlap) → extend στην παρειά', () => {
    // Outline-bbox φτάνει x=1200 (π.χ. λοξό δοκάρι) αλλά ο centerline τελειώνει στο x=1000·
    // κολόνα x∈[1050,1150] → ο άξονας επεκτείνεται μέχρι x=1050.
    const wideOutline: Pt2[] = [
      { x: 0, y: 0 },
      { x: 1200, y: 0 },
      { x: 1200, y: 250 },
      { x: 0, y: 250 },
    ];
    const column = fp([
      { x: 1050, y: -50 },
      { x: 1150, y: -50 },
      { x: 1150, y: 300 },
      { x: 1050, y: 300 },
    ]);
    const res = computeBeamAxisToColumnContact(A_START, A_END, wideOutline, [column]);
    expect(res).not.toBeNull();
    expect(res![1].x).toBeCloseTo(1050, 6); // extend στην κοντινή παρειά
  });

  it('διαμπερής κολόνα στο ΜΕΣΟ → identity (κανένα άκρο δεν πλαισιώνεται)', () => {
    const column = fp([
      { x: 400, y: -50 },
      { x: 600, y: -50 },
      { x: 600, y: 300 },
      { x: 400, y: 300 },
    ]);
    expect(computeBeamAxisToColumnContact(A_START, A_END, BEAM, [column])).toBeNull();
  });

  it('καμία επικάλυψη / κανένα cutter → null', () => {
    const far = fp([
      { x: 3000, y: 0 },
      { x: 3200, y: 0 },
      { x: 3200, y: 200 },
      { x: 3000, y: 200 },
    ]);
    expect(computeBeamAxisToColumnContact(A_START, A_END, BEAM, [far])).toBeNull();
    expect(computeBeamAxisToColumnContact(A_START, A_END, BEAM, [])).toBeNull();
  });

  it('δύο άκρα σε δύο κολόνες → pull-back και στα δύο', () => {
    const left = fp([
      { x: -100, y: -50 },
      { x: 100, y: -50 },
      { x: 100, y: 300 },
      { x: -100, y: 300 },
    ]);
    const right = fp([
      { x: 900, y: -50 },
      { x: 1100, y: -50 },
      { x: 1100, y: 300 },
      { x: 900, y: 300 },
    ]);
    const res = computeBeamAxisToColumnContact(A_START, A_END, BEAM, [left, right]);
    expect(res).not.toBeNull();
    expect(res![0].x).toBeCloseTo(100, 6); // αρχή → παρειά αριστερής
    expect(res![1].x).toBeCloseTo(900, 6); // τέλος → παρειά δεξιάς
  });
});

describe('extendBeamOutlineIntoFramingColumns (ADR-493 — κυκλική παρειά carve)', () => {
  /** Κυκλική Ø400 (32-gon, εγγεγραμμένη) κεντραρισμένη στο origin. */
  const CIRCLE32: Pt2[] = (() => {
    const r = 200;
    const n = 32;
    const v: Pt2[] = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      v.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return v;
  })();
  // Δοκάρι πλάτους 250, ΕΠΙΠΕΔΟ άκρο στην παλιά ορθογώνια παρειά x=200· άξονας y=0.
  const FRAMED_BEAM: Pt2[] = [
    { x: 200, y: -125 },
    { x: 1200, y: -125 },
    { x: 1200, y: 125 },
    { x: 200, y: 125 },
  ];
  const AX_S: Pt2 = { x: 200, y: 0 };
  const AX_E: Pt2 = { x: 1200, y: 0 };

  it('εφαπτόμενο επίπεδο άκρο σε κυκλική → επεκτείνει το άκρο στο κέντρο (x≈0)', () => {
    const ext = extendBeamOutlineIntoFramingColumns(FRAMED_BEAM, AX_S, AX_E, [CIRCLE32]);
    expect(ext).not.toBeNull();
    const xs = ext!.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 6); // start edge → centroid
    expect(xs[1]).toBeCloseTo(0, 6);
    expect(xs[2]).toBeCloseTo(1200, 6); // end edge αμετάβλητο
    expect(xs[3]).toBeCloseTo(1200, 6);
  });

  it('χωρίς επέκταση → identity (μηνίσκος-κενό)· μετά την επέκταση → cutback σκαλίζει άψιδα', () => {
    expect(computeBeamCutbackOutline(FRAMED_BEAM, [CIRCLE32])).toBeNull(); // tangent → identity
    const ext = extendBeamOutlineIntoFramingColumns(FRAMED_BEAM, AX_S, AX_E, [CIRCLE32])!;
    const pieces = computeBeamCutbackOutline(ext, [CIRCLE32]);
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBeGreaterThanOrEqual(1);
    // Το δοκάρι φτάνει την κυκλική παρειά: minX ≈ x στο y=±125 = √(200²−125²) ≈ 156.
    const minX = Math.min(...pieces!.flat().map((p) => p.x));
    expect(minX).toBeGreaterThan(150);
    expect(minX).toBeLessThan(205);
  });

  it('ορθογώνιο 400×400: επέκταση→carve δίνει ΕΠΙΠΕΔΗ παρειά x≈200 (μηδέν regression)', () => {
    const rect: Pt2[] = [
      { x: -200, y: -200 },
      { x: 200, y: -200 },
      { x: 200, y: 200 },
      { x: -200, y: 200 },
    ];
    const ext = extendBeamOutlineIntoFramingColumns(FRAMED_BEAM, AX_S, AX_E, [rect])!;
    const pieces = computeBeamCutbackOutline(ext, [rect]);
    expect(pieces).not.toBeNull();
    const minX = Math.min(...pieces!.flat().map((p) => p.x));
    expect(minX).toBeCloseTo(200, 4);
  });

  it('mid-span κολώνα (κανένα άκρο δεν πλαισιώνεται) → null (μηδέν επέκταση)', () => {
    const mid: Pt2[] = [
      { x: 600, y: -125 },
      { x: 800, y: -125 },
      { x: 800, y: 125 },
      { x: 600, y: 125 },
    ];
    expect(extendBeamOutlineIntoFramingColumns(FRAMED_BEAM, AX_S, AX_E, [mid])).toBeNull();
  });

  it('μακρινή κολώνα (κενό > μισό πλάτος) → null (όχι framing join)', () => {
    const far: Pt2[] = [
      { x: -400, y: -200 },
      { x: 0, y: -200 },
      { x: 0, y: 200 },
      { x: -400, y: 200 },
    ];
    // near face στο x=0, άκρο στο x=200 → nearProj=200 > halfWidth(125) → όχι επέκταση.
    expect(extendBeamOutlineIntoFramingColumns(FRAMED_BEAM, AX_S, AX_E, [far])).toBeNull();
  });
});
