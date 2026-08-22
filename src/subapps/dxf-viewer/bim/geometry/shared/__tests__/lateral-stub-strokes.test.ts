/**
 * ΑΓΚΥΡΑ για τους **αντικριστούς πλευρικούς κλάδους** ορθογώνιου MEP σώματος
 * (ADR-408 · ADR-584 N.18).
 *
 * 🔴 **Γιατί γεννήθηκε**: το `buildMepRadiatorSymbol` και το `buildMepWaterHeaterSymbol`
 * **δεν καλούνταν από κανένα test** — οι φάκελοί τους έχουν μόνο `*-geometry.test.ts`, που
 * ελέγχουν το ίχνος/όγκο και **ποτέ** το σύμβολο. Μετρημένο: τέσσερις μεταλλάξεις στη
 * σύμβαση του κλάδου (αντιστροφή πλευρών · κλάσμα μήκους 0,8→0,5 · πέταγμα του κατωφλίου
 * των 60 mm · πέταγμα της κλίμακας σκηνής) άφηναν **και τις 24 άγκυρες πράσινες**.
 *
 * Ο έλεγχος υπολογίζει τα αναμενόμενα σημεία με **ωμή τριγωνομετρία** εδώ μέσα — δεν
 * εισάγει το `plan-frame`, αλλιώς θα μετακινούνταν ο κριτής μαζί με τον κρινόμενο.
 *
 * Το fixture είναι **στραμμένο** (29°) και **μη τετράγωνο** (600×250): σε κάτοψη 0° μια
 * αντιστροφή προσήμου σε έναν άξονα είναι αόρατη.
 */

import type { BimPoint } from '../../../types/bim-base';
import { buildLateralStubStrokes } from '../rectangular-body-geometry';

const ROT = (29 * Math.PI) / 180;
const COS = Math.cos(ROT);
const SIN = Math.sin(ROT);

const WIDTH = 600; // τοπικός +X (mm)
const LENGTH = 250; // τοπικός +Y (mm)
const CX = 400;
const CY = 130;

/** Οι 4 κορυφές, σύμβαση `rectangular-body-geometry`, ήδη στραμμένες στον κόσμο. */
function footprint(scale: number): BimPoint[] {
  const hw = (WIDTH * scale) / 2;
  const hl = (LENGTH * scale) / 2;
  return ([[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]] as const).map(([lx, ly]) => ({
    x: CX + lx * COS - ly * SIN,
    y: CY + lx * SIN + ly * COS,
    z: 0,
  }));
}

/** Ωμό: σημείο σε απόσταση `a` κατά τον τοπικό +X από το κεντροειδές. */
function alongFromCentre(a: number): BimPoint {
  return { x: CX + COS * a, y: CY + SIN * a, z: 0 };
}

function expectPoint(actual: BimPoint, expected: BimPoint, label: string): void {
  expect([label, actual.x]).toEqual([label, expect.closeTo(expected.x, 9)]);
  expect([label, actual.y]).toEqual([label, expect.closeTo(expected.y, 9)]);
  expect(actual.z).toBe(0);
}

describe('buildLateralStubStrokes — αντικριστοί κλάδοι ορθογώνιου MEP σώματος', () => {
  it('Σ1: εκφυλισμένο ίχνος (≠4 κορυφές) → null, ώστε ο καλών να κρατήσει το δικό του σχήμα', () => {
    expect(buildLateralStubStrokes([], LENGTH, 'mm')).toBeNull();
    expect(buildLateralStubStrokes(footprint(1).slice(0, 3), LENGTH, 'mm')).toBeNull();
  });

  it('Σ2: ρίζες στα μέσα των παρειών −X/+X, φορές αντίθετες, μήκος = 0,8 × length', () => {
    const stubs = buildLateralStubStrokes(footprint(1), LENGTH, 'mm');
    expect(stubs).not.toBeNull();
    if (!stubs) return;

    const [negative, positive] = stubs;
    const half = WIDTH / 2;
    const stubLen = LENGTH * 0.8; // 200 > 60 ⇒ κυριαρχεί το κλάσμα

    // ΠΡΩΤΟ = η −X πλευρά. Η σειρά είναι συμβόλαιο: ο καλών τη χαρτογραφεί σε
    // «παροχή»/«κρύο» (flow:'in') — αντιστροφή θα άλλαζε τη σημασία των συνδέσμων.
    expectPoint(negative[0], alongFromCentre(-half), 'negative.root');
    expectPoint(negative[1], alongFromCentre(-half - stubLen), 'negative.tip');
    expectPoint(positive[0], alongFromCentre(half), 'positive.root');
    expectPoint(positive[1], alongFromCentre(half + stubLen), 'positive.tip');
  });

  it('Σ3: το κατώφλι των 60 mm κυριαρχεί όταν το σώμα είναι κοντό', () => {
    const shortLength = 50; // 50 × 0,8 = 40 < 60 ⇒ κερδίζει το κατώφλι
    const stubs = buildLateralStubStrokes(footprint(1), shortLength, 'mm');
    expect(stubs).not.toBeNull();
    if (!stubs) return;

    const reach = Math.hypot(stubs[1][1].x - stubs[1][0].x, stubs[1][1].y - stubs[1][0].y);
    expect(reach).toBeCloseTo(60, 9);
  });

  it('Σ4: το μήκος κλάδου ΚΛΙΜΑΚΩΝΕΤΑΙ με τις μονάδες σκηνής (m ⇒ ×0,001)', () => {
    const scale = 0.001; // sceneUnits: 'm'
    const stubs = buildLateralStubStrokes(footprint(scale), LENGTH, 'm');
    expect(stubs).not.toBeNull();
    if (!stubs) return;

    const reach = Math.hypot(stubs[1][1].x - stubs[1][0].x, stubs[1][1].y - stubs[1][0].y);
    expect(reach).toBeCloseTo(LENGTH * 0.8 * scale, 9);

    // Και η ρίζα κάθεται στη μισή ΚΛΙΜΑΚΩΜΕΝΗ παρειά — όχι στα ωμά mm.
    expectPoint(stubs[1][0], alongFromCentre((WIDTH * scale) / 2), 'positive.root@m');
  });

  it('Σ5: οι δύο κλάδοι είναι ακριβώς αντίθετοι — συμμετρικοί ως προς το κεντροειδές', () => {
    const [negative, positive] = buildLateralStubStrokes(footprint(1), LENGTH, 'mm') ?? [];
    expect(negative).toBeDefined();
    if (!negative || !positive) return;

    // Μέσο των δύο άκρων = το κεντροειδές ⇒ ίσα και αντίθετα διανύσματα.
    expect((negative[1].x + positive[1].x) / 2).toBeCloseTo(CX, 9);
    expect((negative[1].y + positive[1].y) / 2).toBeCloseTo(CY, 9);
  });
});
