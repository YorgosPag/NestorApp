/**
 * ADR-569 — «Δοκάρι ανάμεσα σε μέλη» pure builder tests (connector + build).
 * Δεν εξετάζουμε το picking (χρειάζεται πλήρη entities) — μόνο τη γεωμετρία/κατασκευή
 * που καθορίζει preview ≡ commit.
 */
import {
  connectorBetweenMembers,
  connectorFromMemberToPoint,
  buildBeamBetweenMembers,
  computeBeamAxisBetweenMembers,
  type PickedStructuralMember,
} from '../beam-between-members';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { justifyAxisPoints } from '../../grid/axis-justify';

const square = (x0: number, y0: number, s: number): Point2D[] => [
  { x: x0, y: y0 },
  { x: x0 + s, y: y0 },
  { x: x0 + s, y: y0 + s },
  { x: x0, y: y0 + s },
];

const rect = (xmin: number, ymin: number, xmax: number, ymax: number): Point2D[] => [
  { x: xmin, y: ymin },
  { x: xmax, y: ymin },
  { x: xmax, y: ymax },
  { x: xmin, y: ymax },
];

const member = (footprint: Point2D[], id = 'm'): PickedStructuralMember => ({
  entity: { id, type: 'column' } as unknown as Entity,
  footprint,
});

describe('connectorBetweenMembers', () => {
  it('connects the facing faces of two separated members', () => {
    const seg = connectorBetweenMembers(member(square(0, 0, 200)), member(square(1200, 0, 200)));
    expect(seg).not.toBeNull();
    expect(seg!.dist).toBeCloseTo(1000);
    expect(seg!.a.x).toBeCloseTo(200);
    expect(seg!.b.x).toBeCloseTo(1200);
  });

  it('returns null for touching members (no clean gap)', () => {
    expect(connectorBetweenMembers(member(square(0, 0, 200)), member(square(200, 0, 200)))).toBeNull();
  });
});

describe('connectorFromMemberToPoint', () => {
  it('anchors on the member face looking at the cursor', () => {
    const seg = connectorFromMemberToPoint(member(square(0, 0, 200)), { x: 500, y: 100 });
    expect(seg.a.x).toBeCloseTo(200);
    expect(seg.a.y).toBeCloseTo(100);
    expect(seg.b).toEqual({ x: 500, y: 100 });
    expect(seg.dist).toBeCloseTo(300);
  });
});

describe('computeBeamAxisBetweenMembers — face-to-face span + lateral flush', () => {
  // A = βαθύ 40×40 [y −20..20], B = στενό 60×25 [y −12.5..12.5]. Κοινή επικάλυψη = [−12.5, 12.5].
  const deepA = rect(0, -20, 40, 20);
  const shallowB = rect(500, -12.5, 560, 12.5);

  it('span = παρειά-προς-παρειά (A ανατ. παρειά → B δυτ. παρειά)', () => {
    const axis = computeBeamAxisBetweenMembers(deepA, shallowB, 5)!;
    expect(axis.a.x).toBeCloseTo(40); // ανατολική παρειά του A
    expect(axis.b.x).toBeCloseTo(500); // δυτική παρειά του B
  });

  it('2ο κλικ ΔΕΞΙΑ → νότια-flush στην άκρη της επικάλυψης (παρειά στενότερης)', () => {
    // width 10 → halfW 5· νότια-flush: centerline t = lo + halfW = −12.5 + 5 = −7.5.
    const axis = computeBeamAxisBetweenMembers(deepA, shallowB, 5)!;
    expect(axis.a.y).toBeCloseTo(-7.5);
    expect(axis.b.y).toBeCloseTo(-7.5);
  });

  it('2ο κλικ ΑΡΙΣΤΕΡΑ → βόρεια-flush στην άκρη της επικάλυψης', () => {
    // B (στενό) στα 500, A (βαθύ) στο 0· τώρα dx<0 → βόρεια-flush: t = hi − halfW = 12.5 − 5 = 7.5.
    const axis = computeBeamAxisBetweenMembers(shallowB, deepA, 5)!;
    expect(axis.a.y).toBeCloseTo(7.5);
    expect(axis.b.y).toBeCloseTo(7.5);
  });

  it('width = βάθος επικάλυψης → κεντραρισμένο (flush ≡ centered)', () => {
    // overlap depth = 25 → halfW 12.5 → νότια-flush t = −12.5 + 12.5 = 0 (κέντρο).
    const axis = computeBeamAxisBetweenMembers(deepA, shallowB, 12.5)!;
    expect(axis.a.y).toBeCloseTo(0);
  });

  it('ταυτόσημα κέντρα → null', () => {
    expect(computeBeamAxisBetweenMembers(square(0, 0, 40), square(0, 0, 40), 5)).toBeNull();
  });

  it('μέλη με κέντρα σε ΔΙΑΦΟΡΕΤΙΚΟ Y → δοκάρι ΟΡΘΟΓΩΝΙΟ, όχι λοξό (ADR-569 fix)', () => {
    // A [x 0..40, y 0..40] κέντρο (20,20)· B [x 500..540, y 30..70] κέντρο (520,50): κέντρα διαφέρουν
    // κατά 30 σε Y. centroid→centroid θα έγερνε τον άξονα (~3.4°). Facing-κάθετος → οριζόντιο δοκάρι.
    const A = rect(0, 0, 40, 40);
    const B = rect(500, 30, 540, 70);
    const axis = computeBeamAxisBetweenMembers(A, B, 5)!;
    expect(axis).not.toBeNull();
    expect(axis.a.y).toBeCloseTo(axis.b.y); // ΟΡΘΟΓΩΝΙΟ (μηδέν κλίση), όχι λοξό
    expect(axis.a.x).toBeCloseTo(40); // ανατ. παρειά A
    expect(axis.b.x).toBeCloseTo(500); // δυτ. παρειά B
  });
});

describe('computeBeamAxisBetweenMembers — Τ-καθρέφτης (δοκάρι ΜΕΣΑ στα ευθυγραμμισμένα σκέλη, ADR-569)', () => {
  // Πραγματικά footprints (Giorgio 2026-07-03, μεταφρασμένα στο (0,0)). A = «⊢» (spine αριστερά +
  // βραχίονας ανατ. σε y 450..700)· B = «⊣» καθρέφτης (βραχίονας δυτ., ΙΔΙΟ y 450..700). Οι βραχίονες
  // ευθυγραμμισμένοι. Το δοκάρι πρέπει να ΦΩΛΙΑΣΕΙ σε αυτή τη ζώνη (ΣΩΣΤΟ ΘΕΛΩ), ΟΧΙ να πέσει στον
  // νότιο πάτο του spine y≈0 (ΛΑΘΟΣ ΤΩΡΑ) — το bug που δίνει η προβολή ΟΛΟΥ του footprint αντί της παρειάς.
  const tLeft: Point2D[] = [
    { x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 450 }, { x: 1250, y: 450 },
    { x: 1250, y: 700 }, { x: 250, y: 700 }, { x: 250, y: 1150 }, { x: 0, y: 1150 },
  ];
  const tRight: Point2D[] = [
    { x: 4250, y: -150 }, { x: 4250, y: 1300 }, { x: 4000, y: 1300 }, { x: 4000, y: 700 },
    { x: 3000, y: 700 }, { x: 3000, y: 450 }, { x: 4000, y: 450 }, { x: 4000, y: -150 },
  ];

  it('span = άκρα των αντικριστών βραχιόνων (όχι των spine)', () => {
    const axis = computeBeamAxisBetweenMembers(tLeft, tRight, 125)!;
    expect(axis.a.x).toBeCloseTo(1250); // ανατ. άκρο βραχίονα A
    expect(axis.b.x).toBeCloseTo(3000); // δυτ. άκρο βραχίονα B
  });

  it('φωλιάζει στη ζώνη των σκελών y 450..700, ΟΧΙ στον νότιο πάτο του spine', () => {
    // width 250 → halfW 125· facing-band = βραχίονας [450,700] (κέντρο 575). ομοαξονικοί → κέντρο άξονα
    // t = (lo+hi)/2 = 0 → centerline στο 575 (= κέντρο ζώνης). ΧΩΡΙΣ το fix θα έπεφτε στο ~125 (spine).
    const axis = computeBeamAxisBetweenMembers(tLeft, tRight, 125)!;
    expect(axis.a.y).toBeCloseTo(575);
    expect(axis.b.y).toBeCloseTo(575);
    expect(axis.a.y - 125).toBeCloseTo(450); // νότια παρειά δοκαριού = νότιο σκελών
    expect(axis.a.y + 125).toBeCloseTo(700); // βόρεια παρειά δοκαριού = βόρειο σκελών
    expect(axis.a.y).toBeGreaterThan(400); // ΔΕΝ πέφτει στον πάτο του spine (y≈125)
  });

  it('ομοαξονικοί βραχίονες → justification CENTER + άξονας στο κοινό κέντρο (associative, Giorgio)', () => {
    const axis = computeBeamAxisBetweenMembers(tLeft, tRight, 125)!;
    expect(axis.justification).toBe('center'); // κέντρο άξονα, ΟΧΙ 'left'/'right' (νότια-flush)
    // Με ΔΙΑΦΟΡΕΤΙΚΟ πλάτος (μικρότερο halfW) ο άξονας ΜΕΝΕΙ στον κοινό άξονα 575 (δεν ξεκολλά νότια).
    const narrow = computeBeamAxisBetweenMembers(tLeft, tRight, 60)!;
    expect(narrow.a.y).toBeCloseTo(575);
    expect(narrow.justification).toBe('center');
  });
});

describe('buildBeamBetweenMembers', () => {
  it('builds a beam entity along the shortest face-to-face path', () => {
    const result = buildBeamBetweenMembers(
      member(square(0, 0, 200)),
      member(square(1200, 0, 200)),
      '0',
      {},
      'mm',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.type).toBe('beam');
      expect(result.connector.dist).toBeCloseTo(1000);
    }
  });

  it('no-connector για εφαπτόμενα μέλη (καμία καθαρή facing-ακμή)', () => {
    // Εφαπτόμενα στη x=200 → η facing-ακμή έχει dist≈0 → no-connector (ίδιο με τον οπτικό connector).
    const result = buildBeamBetweenMembers(
      member(square(0, 0, 200)),
      member(square(200, 0, 200)),
      '0',
      {},
      'mm',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-connector');
  });

  it('αγκυρώνει τη ΝΟΤΙΑ παρειά — associative με το πλάτος (ADR-529, Giorgio)', () => {
    // 2 κολόνες [x 0..40 / 500..540, y 0..400] ευθυγραμμισμένες, νότια παρειά y=0. Δοκάρι width 200,
    // νότια-flush. Πρέπει να αποθηκευτεί ΟΧΙ centerline αλλά **location line = νότια παρειά (y=0)** +
    // justification, ώστε όταν ο οργανισμός μειώσει το πλάτος, η νότια παρειά να ΜΕΝΕΙ στο y=0.
    const A = rect(0, 0, 40, 400);
    const B = rect(500, 0, 540, 400);
    const res = buildBeamBetweenMembers(member(A), member(B), '0', { width: 200 }, 'mm');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p = res.entity.params;
    expect(p.justification).toBe('left'); // αγκυρωμένο (όχι centered)
    // Stored location line = νότια παρειά (y=0), ΟΧΙ ο centerline (που θα ήταν y=100 για width 200).
    expect(p.startPoint.y).toBeCloseTo(0);
    expect(p.endPoint.y).toBeCloseTo(0);
    // Associative: για ΚΑΘΕ πλάτος, νότια παρειά = body.y − W/2 μένει στο y=0 (canonical normal = +y).
    const bodyWide = justifyAxisPoints(p.startPoint, p.endPoint, 200, p.justification, 'mm');
    const bodyNarrow = justifyAxisPoints(p.startPoint, p.endPoint, 100, p.justification, 'mm');
    expect(bodyWide.start.y - 200 / 2).toBeCloseTo(0); // width 200 → νότια παρειά y=0
    expect(bodyNarrow.start.y - 100 / 2).toBeCloseTo(0); // width 100 → νότια παρειά ΑΚΟΜΗ y=0
  });

  it('no-connector για ταυτόσημα κέντρα (concentric)', () => {
    const result = buildBeamBetweenMembers(
      member(square(0, 0, 200)),
      member(square(0, 0, 200)),
      '0',
      {},
      'mm',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-connector');
  });
});
