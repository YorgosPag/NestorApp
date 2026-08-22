/**
 * ΑΓΚΥΡΑ γεωμετρίας για τα glyphs του λέβητα (ADR-408 · ADR-584 N.18 · ADR-793).
 *
 * 🔴 **Γιατί γεννήθηκε**: μέχρι σήμερα οι πέντε builders του θαλάμου
 * (`buildFlameStrokes` · `buildSafetyValveGlyph` · `buildExpansionVesselGlyph` ·
 * `buildPressureGaugeGlyph` · `buildFillingLoopGlyph`) **δεν καλούνταν από κανένα
 * test** — μετρημένο με grep σε ΟΛΟ το `src/`. Οι 61 άγκυρες του
 * `mep-boiler-symbol.test.ts` πιάνουν **μόνο** τα connector stubs, και μάλιστα σε
 * σημεία με `perpOffset = 0`. Απόδειξη ότι το κενό ήταν πραγματικό: αναστροφή
 * προσήμου στην καρδιά του {@link framePoint} (`+ perp.y` → `− perp.y`) άφησε
 * **61/61 πράσινα**. *Πράσινο που κανείς δεν κοίταξε δεν είναι απόδειξη.*
 *
 * ## Ο παρονομαστής: ΔΕΥΤΕΡΗ ΦΩΝΗ, όχι το ίδιο SSoT
 *
 * Ο έλεγχος **δεν** εισάγει το `plan-frame`. Υπολογίζει κάθε αναμενόμενο σημείο με
 * **ωμή τριγωνομετρία** μέσα σε αυτό το αρχείο ({@link rawPoint}) — αλλιώς θα
 * επικύρωνε τον εαυτό του: μια μετάλλαξη στο SSoT θα μετακινούσε **ταυτόχρονα**
 * τον κριτή και τον κρινόμενο, και η άγκυρα θα έμενε πράσινη πάνω στη βλάβη.
 *
 * ## Το σχήμα του fixture είναι ΜΕΡΟΣ της απόδειξης
 *
 * - **Στραμμένο** σώμα (37°, όχι 0°) ⇒ οι δύο άξονες έχουν **και τις δύο**
 *   συνιστώσες μη μηδενικές· σε κάτοψη 0° το `perp` είναι `(0,1)` και μια
 *   αναστροφή προσήμου στο `along.y` θα ήταν **αόρατη**.
 * - **Μη τετράγωνο** ίχνος (450×350) ⇒ ένας κύκλος σχεδιασμένος σε
 *   **κανονικοποιημένους** (ανισότροπους) άξονες θα έβγαινε **έλλειψη**. Το `Κ3`
 *   το μετράει ρητά — είναι ο μηχανικός φρουρός της απόφασης να ΜΗΝ ενωθεί το
 *   `plan-frame` με το `symbol-vector-helpers` (δες το docblock του SSoT).
 * - **Μετατοπισμένη** θέση ⇒ σφάλμα που ξεχνά τη μεταφορά δεν κρύβεται στο (0,0).
 *
 * ⚠️ Τα κλάσματα εδώ είναι **σκόπιμα αντιγραμμένα** από τον builder: είναι η
 * **ταυτότητα του συμβόλου**. Αν κάποιος τα αλλάξει, αυτή η άγκυρα ΠΡΕΠΕΙ να
 * κοκκινίσει ώστε να το δει άνθρωπος — δεν είναι λεπτομέρεια υλοποίησης.
 *
 * @see ../mep-boiler-symbol-glyphs.ts — ο κρινόμενος
 * @see ../../geometry/shared/plan-frame.ts — το SSoT που ΔΕΝ εισάγεται εδώ
 */

import type { BimPoint } from '../../types/bim-base';
import {
  buildClearanceOutline,
  buildDividerStroke,
  buildFlameStrokes,
  buildSafetyValveGlyph,
  buildExpansionVesselGlyph,
  buildPressureGaugeGlyph,
  buildFillingLoopGlyph,
  buildFlueVentStroke,
  buildFuelCockStroke,
  buildCondensateTrapStroke,
  buildCondensateNeutraliserStroke,
} from '../mep-boiler-symbol-glyphs';

// ─── Fixture: στραμμένο, μη τετράγωνο, μετατοπισμένο ───────────────────────────

const ROT_DEG = 37;
const ROT = (ROT_DEG * Math.PI) / 180;
const COS = Math.cos(ROT);
const SIN = Math.sin(ROT);

/** Πλάτος (τοπικός +X) και βάθος (τοπικός +Y) σε canvas units — ΔΙΑΦΟΡΕΤΙΚΑ επίτηδες. */
const WIDTH = 450;
const DEPTH = 350;

/** Κεντροειδές ίχνους — μακριά από την αρχή, ώστε χαμένη μεταφορά να φαίνεται. */
const CX = 1200;
const CY = -800;

/** Μοναδιαίοι άξονες του στραμμένου σώματος (ωμά, χωρίς το SSoT). */
const ALONG = { x: COS, y: SIN };
const PERP = { x: -SIN, y: COS };

/** Οι 4 κορυφές με τη σύμβαση του `rectangular-body-geometry`: v0=(−hw,−hl) … */
function footprint(): [BimPoint, BimPoint, BimPoint, BimPoint] {
  const hw = WIDTH / 2;
  const hl = DEPTH / 2;
  const local: readonly [number, number][] = [
    [-hw, -hl],
    [hw, -hl],
    [hw, hl],
    [-hw, hl],
  ];
  const world = local.map(([lx, ly]) => ({
    x: CX + lx * COS - ly * SIN,
    y: CY + lx * SIN + ly * COS,
    z: 0,
  }));
  return [world[0], world[1], world[2], world[3]];
}

/**
 * ΩΜΟΣ υπολογισμός: σημείο σε απόσταση `a` κατά τον +X και `b` κατά τον +Y από
 * `(ox, oy)`. Ανεξάρτητος από το `plan-frame` — αυτή είναι όλη η ουσία.
 */
function rawPoint(ox: number, oy: number, a: number, b: number): BimPoint {
  return { x: ox + ALONG.x * a + PERP.x * b, y: oy + ALONG.y * a + PERP.y * b, z: 0 };
}

/** Ωμό κέντρο υπο-πλαισίου, μετρημένο από το κεντροειδές του ίχνους. */
function rawCentre(a: number, b: number): BimPoint {
  return rawPoint(CX, CY, a, b);
}

const PRECISION = 9;

function expectPoint(actual: BimPoint, expected: BimPoint, label: string): void {
  expect([label, actual.x]).toEqual([label, expect.closeTo(expected.x, PRECISION)]);
  expect([label, actual.y]).toEqual([label, expect.closeTo(expected.y, PRECISION)]);
  expect(actual.z).toBe(0);
}

function expectStroke(
  actual: readonly BimPoint[],
  expected: readonly BimPoint[],
  label: string,
): void {
  expect(`${label}.length=${actual.length}`).toBe(`${label}.length=${expected.length}`);
  actual.forEach((p, i) => expectPoint(p, expected[i], `${label}[${i}]`));
}

// ─── Κ1-Κ2 · περίγραμμα + διαχωριστικό ────────────────────────────────────────

describe('Κ1-Κ2 — outline / divider', () => {
  it('Κ1: η ζώνη συντήρησης μετατοπίζει ΚΑΘΕ κορυφή κατά `c` και στους δύο άξονες', () => {
    const [v0, v1, v2, v3] = footprint();
    const c = 120;
    const out = buildClearanceOutline(v0, v1, v2, v3, c);

    expect(out).toHaveLength(4);
    expectPoint(out[0], rawPoint(v0.x, v0.y, -c, -c), 'clearance[0]');
    expectPoint(out[1], rawPoint(v1.x, v1.y, c, -c), 'clearance[1]');
    expectPoint(out[2], rawPoint(v2.x, v2.y, c, c), 'clearance[2]');
    expectPoint(out[3], rawPoint(v3.x, v3.y, -c, c), 'clearance[3]');
  });

  it('Κ2: το διαχωριστικό κόβει και τα δύο πλευρικά τοιχώματα στο 40% του βάθους', () => {
    const [v0, v1, v2, v3] = footprint();
    const f = 0.4; // DIVIDER_FRAC
    const stroke = buildDividerStroke(v0, v1, v2, v3);

    expectStroke(
      stroke,
      [
        { x: v0.x + (v3.x - v0.x) * f, y: v0.y + (v3.y - v0.y) * f, z: 0 },
        { x: v1.x + (v2.x - v1.x) * f, y: v1.y + (v2.y - v1.y) * f, z: 0 },
      ],
      'divider',
    );
  });
});

// ─── Κ3 · Η ΑΝΙΣΟΤΡΟΠΙΑ — ο φρουρός του «κύκλος, όχι έλλειψη» ─────────────────

describe('Κ3 — ο κύκλος μένει κύκλος σε ΜΗ τετράγωνο σώμα', () => {
  it('Κ3α: κάθε κορυφή του δοχείου διαστολής ισαπέχει από το κέντρο του', () => {
    const [v0, v1, v2, v3] = footprint();
    const [circle] = buildExpansionVesselGlyph(v0, v1, v2, v3);
    const centre = rawCentre(WIDTH * 0.28, -DEPTH * 0.22);
    const r = DEPTH * 0.1;

    expect(circle.length).toBe(17); // VESSEL_SEGMENTS + 1 — κλειστό 16-γωνο
    for (const p of circle) {
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeCloseTo(r, PRECISION);
    }
  });

  it('Κ3β: το ίδιο για τον δίσκο του μανομέτρου — ΟΧΙ κλάσμα του κάθε άξονα', () => {
    const [v0, v1, v2, v3] = footprint();
    const [circle] = buildPressureGaugeGlyph(v0, v1, v2, v3);
    const centre = rawCentre(-WIDTH * 0.28, DEPTH * 0.22);
    const r = DEPTH * 0.1;

    for (const p of circle) {
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeCloseTo(r, PRECISION);
    }
  });
});

// ─── Κ4-Κ7 · τα τέσσερα glyphs του θαλάμου, σημείο προς σημείο ────────────────

describe('Κ4-Κ7 — glyphs θαλάμου έναντι ωμού υπολογισμού', () => {
  it('Κ4: φλόγα — τρίγωνο στον κάτω θάλαμο', () => {
    const [v0, v1, v2, v3] = footprint();
    const chamber = WIDTH * (0.5 - 0.4 / 2);
    const fc = rawCentre(-chamber * 0.5, 0);
    const halfBase = DEPTH * 0.14;
    const flameH = WIDTH * 0.22;

    const baseLeft = rawPoint(fc.x, fc.y, 0, -halfBase);
    const baseRight = rawPoint(fc.x, fc.y, 0, halfBase);
    const apex = rawPoint(fc.x, fc.y, flameH, 0);

    const strokes = buildFlameStrokes(v0, v1, v2, v3);
    expect(strokes).toHaveLength(3);
    expectStroke(strokes[0], [baseLeft, baseRight], 'flame.base');
    expectStroke(strokes[1], [baseLeft, apex], 'flame.legL');
    expectStroke(strokes[2], [baseRight, apex], 'flame.legR');
  });

  it('Κ5: ασφαλιστική βαλβίδα — παπιγιόν + στέλεχος + βέλος στον άνω θάλαμο (+Y)', () => {
    const [v0, v1, v2, v3] = footprint();
    const c = rawCentre(WIDTH * 0.28, DEPTH * 0.22);
    const bodyHalf = WIDTH * 0.07;
    const baseHalf = DEPTH * 0.06;
    const discharge = WIDTH * 0.12;
    const arrowLen = WIDTH * 0.05;
    const arrowHalf = DEPTH * 0.05;
    const at = (a: number, b: number) => rawPoint(c.x, c.y, a, b);

    const stemEnd = at(bodyHalf + discharge, 0);
    const strokes = buildSafetyValveGlyph(v0, v1, v2, v3);

    expect(strokes).toHaveLength(5);
    expectStroke(
      strokes[0],
      [c, at(-bodyHalf, baseHalf), at(-bodyHalf, -baseHalf), c],
      'valve.inner',
    );
    expectStroke(
      strokes[1],
      [c, at(bodyHalf, baseHalf), at(bodyHalf, -baseHalf), c],
      'valve.outer',
    );
    expectStroke(strokes[2], [at(bodyHalf, 0), stemEnd], 'valve.stem');
    expectStroke(strokes[3], [at(bodyHalf + discharge - arrowLen, arrowHalf), stemEnd], 'valve.chevL');
    expectStroke(strokes[4], [at(bodyHalf + discharge - arrowLen, -arrowHalf), stemEnd], 'valve.chevR');
  });

  it('Κ6: δοχείο διαστολής — μεμβράνη + στέλεχος, ΑΠΕΝΑΝΤΙ από τη βαλβίδα (−Y)', () => {
    const [v0, v1, v2, v3] = footprint();
    const c = rawCentre(WIDTH * 0.28, -DEPTH * 0.22);
    const r = DEPTH * 0.1;
    const stemLen = WIDTH * 0.06;
    const at = (a: number, b: number) => rawPoint(c.x, c.y, a, b);

    const [circle, diaphragm, stem] = buildExpansionVesselGlyph(v0, v1, v2, v3);

    expectPoint(circle[0], at(r, 0), 'vessel.circle[0]');
    expectPoint(circle[16], at(r, 0), 'vessel.circle[16]'); // κλειστό
    expectStroke(diaphragm, [at(0, r), at(0, -r)], 'vessel.diaphragm');
    expectStroke(stem, [at(-r, 0), at(-(r + stemLen), 0)], 'vessel.stem');
  });

  it('Κ7: μανόμετρο — βελόνα στις ~45° + ρόμβος άξονα', () => {
    const [v0, v1, v2, v3] = footprint();
    const c = rawCentre(-WIDTH * 0.28, DEPTH * 0.22);
    const r = DEPTH * 0.1;
    const needle = r * 0.82;
    const pivot = r * 0.16;
    const at = (a: number, b: number) => rawPoint(c.x, c.y, a, b);

    const [, needleLine, pivotDot] = buildPressureGaugeGlyph(v0, v1, v2, v3);

    expectStroke(
      needleLine,
      [c, at(needle * Math.SQRT1_2, needle * Math.SQRT1_2)],
      'gauge.needle',
    );
    expectStroke(
      pivotDot,
      [at(pivot, 0), at(0, pivot), at(-pivot, 0), at(0, -pivot), at(pivot, 0)],
      'gauge.pivot',
    );
  });
});

// ─── Κ8 · βρόχος πλήρωσης — το ημικύκλιο ξεκινά στις −90° ────────────────────

describe('Κ8 — βρόχος πλήρωσης', () => {
  it('Κ8: αγωγός + 2 chevrons + ημικύκλιο + 2 τικ απομόνωσης', () => {
    const [v0, v1, v2, v3] = footprint();
    const c = rawCentre(-WIDTH * 0.28, -DEPTH * 0.22);
    const runHalf = DEPTH * 0.1;
    const chevLen = DEPTH * 0.05;
    const chevHalf = WIDTH * 0.04;
    const r = WIDTH * 0.06;
    const tickHalf = WIDTH * 0.04;
    const at = (a: number, b: number) => rawPoint(c.x, c.y, a, b);

    const [run, chev1, chev2, loopArc, tick1, tick2] = buildFillingLoopGlyph(v0, v1, v2, v3);

    expectStroke(run, [at(0, -runHalf), at(0, runHalf)], 'filling.run');

    const chevron = (p: number) => [at(chevHalf, p), at(0, p + chevLen), at(-chevHalf, p)];
    expectStroke(chev1, chevron(-runHalf * 0.45), 'filling.chev1');
    expectStroke(chev2, chevron(runHalf * 0.1), 'filling.chev2');

    // Ημικύκλιο: πρώτο σημείο στο −perp, κορυφή στο +along, τελευταίο στο +perp.
    expect(loopArc).toHaveLength(17);
    expectPoint(loopArc[0], at(0, -r), 'filling.arc[0]');
    expectPoint(loopArc[8], at(r, 0), 'filling.arc[8]');
    expectPoint(loopArc[16], at(0, r), 'filling.arc[16]');

    expectStroke(tick1, [at(-tickHalf, -runHalf), at(tickHalf, -runHalf)], 'filling.tick1');
    expectStroke(tick2, [at(-tickHalf, runHalf), at(tickHalf, runHalf)], 'filling.tick2');
  });
});

// ─── Κ9-Κ12 · τα glyphs του συνδέσμου (stub frame) ───────────────────────────

describe('Κ9-Κ12 — connector glyphs', () => {
  /** Ρίζα κλάδου εκτός άξονα + φορά εξόδου που ΔΕΝ είναι παράλληλη σε άξονα. */
  const ROOT: BimPoint = { x: 640, y: 190, z: 0 };
  const OUT = { x: COS, y: SIN };
  const PERP_OUT = { x: -SIN, y: COS };
  const STUB = 280;

  const stubAt = (a: number, b: number): BimPoint => ({
    x: ROOT.x + OUT.x * a + PERP_OUT.x * b,
    y: ROOT.y + OUT.y * a + PERP_OUT.y * b,
    z: 0,
  });

  it('Κ9: καπναγωγός — κλάδος + chevron στην άκρη', () => {
    const aLen = STUB * 0.32;
    const aHalf = STUB * 0.2;
    const tip = stubAt(STUB, 0);
    const strokes = buildFlueVentStroke(ROOT, OUT, STUB);

    expect(strokes).toHaveLength(3);
    expectStroke(strokes[0], [ROOT, tip], 'vent.stub');
    expectStroke(strokes[1], [stubAt(STUB - aLen, aHalf), tip], 'vent.legL');
    expectStroke(strokes[2], [stubAt(STUB - aLen, -aHalf), tip], 'vent.legR');
  });

  it('Κ10: κρουνός αερίου — παπιγιόν στην άκρη + μοχλός κάθετα', () => {
    const vLen = STUB * 0.22;
    const vHalf = STUB * 0.16;
    const hLen = STUB * 0.22;
    const barHalf = STUB * 0.12;
    const tip = stubAt(STUB, 0);
    const stemEnd = stubAt(STUB, hLen);
    const strokes = buildFuelCockStroke(ROOT, OUT, STUB);

    expect(strokes).toHaveLength(5);
    expectStroke(strokes[0], [ROOT, tip], 'cock.stub');
    expectStroke(
      strokes[1],
      [tip, stubAt(STUB - vLen, vHalf), stubAt(STUB - vLen, -vHalf), tip],
      'cock.inner',
    );
    expectStroke(
      strokes[2],
      [tip, stubAt(STUB + vLen, vHalf), stubAt(STUB + vLen, -vHalf), tip],
      'cock.outer',
    );
    expectStroke(strokes[3], [tip, stemEnd], 'cock.lever');
    expectStroke(
      strokes[4],
      [stubAt(STUB + barHalf, hLen), stubAt(STUB - barHalf, hLen)],
      'cock.bar',
    );
  });

  it('Κ11: σιφώνι συμπυκνωμάτων — «∪» με το στόμιο προς τον λέβητα', () => {
    const depth = STUB * 0.24;
    const half = STUB * 0.16;
    const strokes = buildCondensateTrapStroke(ROOT, OUT, STUB);

    expect(strokes).toHaveLength(2);
    expectStroke(strokes[0], [ROOT, stubAt(STUB, 0)], 'trap.stub');
    expectStroke(
      strokes[1],
      [
        stubAt(STUB - depth, half),
        stubAt(STUB + depth, half),
        stubAt(STUB + depth + half, 0),
        stubAt(STUB + depth, -half),
        stubAt(STUB - depth, -half),
      ],
      'trap.uBend',
    );
  });

  it('Κ12: εξουδετερωτής — κλειστό ορθογώνιο στο μέσο του κλάδου', () => {
    const halfLen = STUB * 0.16;
    const half = STUB * 0.13;
    const mid = STUB * 0.5;
    const [rect] = buildCondensateNeutraliserStroke(ROOT, OUT, STUB);

    expectStroke(
      rect,
      [
        stubAt(mid - halfLen, half),
        stubAt(mid + halfLen, half),
        stubAt(mid + halfLen, -half),
        stubAt(mid - halfLen, -half),
        stubAt(mid - halfLen, half),
      ],
      'neutraliser.rect',
    );
  });
});
