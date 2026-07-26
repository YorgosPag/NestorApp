/**
 * ADR-713 — ζώνη έκθεσης κολώνας (στάθμη εδάφους ≠ όριο όγκου ADR-712).
 *
 * Κλειδώνει: τον cascade (τοπογραφικό → σταθερά κτιρίου → FFL), το ότι το default δίνει
 * θαμμένη ζώνη **ταυτόσημη με το κοντόστυλο** του ADR-712, τον clamp και στα δύο άκρα,
 * το sliver reject και το degenerate fail-safe.
 */

import {
  resolveColumnExposureZones,
  resolveExposureGradeAbsMm,
  hasBuriedZone,
  DEFAULT_GRADE_DROP_BELOW_BASE_MM,
  MIN_EXPOSURE_ZONE_MM,
} from '../column-exposure-zone';

/** Κολώνα ισογείου 3000mm ύψος, εδρασμένη σε πέδιλο 1000mm χαμηλότερα. */
const GROUND_FLOOR_COLUMN = {
  nominalBaseAbsMm: 0,
  topAbsMm: 3000,
  baseDropMm: 1000,
} as const;

describe('resolveExposureGradeAbsMm — ο cascade στάθμης εδάφους', () => {
  it('default (χωρίς τοπογραφικό, χωρίς ρύθμιση) → στάθμη στο FFL', () => {
    expect(DEFAULT_GRADE_DROP_BELOW_BASE_MM).toBe(0);
    expect(resolveExposureGradeAbsMm({ nominalBaseAbsMm: 0 })).toBe(0);
  });

  it('tier 2 — η σταθερά κτιρίου κατεβάζει τη στάθμη κάτω από το FFL', () => {
    expect(resolveExposureGradeAbsMm({ nominalBaseAbsMm: 0, gradeDropBelowBaseMm: 300 })).toBe(-300);
  });

  it('tier 1 — το τοπογραφικό ΥΠΕΡΙΣΧΥΕΙ της σταθεράς κτιρίου', () => {
    const g = resolveExposureGradeAbsMm({
      nominalBaseAbsMm: 0, gradeDropBelowBaseMm: 300, terrainGradeAbsMm: -800,
    });
    expect(g).toBe(-800);
  });

  it('tier 1 απών (`null`) → πέφτει στο tier 2, δεν μηδενίζει τη στάθμη', () => {
    const g = resolveExposureGradeAbsMm({
      nominalBaseAbsMm: 0, gradeDropBelowBaseMm: 300, terrainGradeAbsMm: null,
    });
    expect(g).toBe(-300);
  });

  it('αρνητική σταθερά κτιρίου → clamp στο 0 (η στάθμη δεν ανεβαίνει πάνω από το FFL έτσι)', () => {
    expect(resolveExposureGradeAbsMm({ nominalBaseAbsMm: 0, gradeDropBelowBaseMm: -500 })).toBe(0);
  });

  it('η στάθμη είναι σχετική με τη ΒΑΣΗ, όχι απόλυτη (κολώνα ορόφου)', () => {
    expect(resolveExposureGradeAbsMm({ nominalBaseAbsMm: 3000, gradeDropBelowBaseMm: 300 })).toBe(2700);
  });
});

describe('resolveColumnExposureZones — ζώνες', () => {
  it('ADR-712 parity: στο default, η θαμμένη ζώνη ΕΙΝΑΙ το κοντόστυλο (baseDropMm)', () => {
    const z = resolveColumnExposureZones(GROUND_FLOOR_COLUMN);
    // Αυτό είναι το συμβόλαιο που κρατά render και επιμέτρηση ευθυγραμμισμένα: όση κολώνα
    // χρεώνεται ως σκυρόδεμα θεμελίων (OIK-2.07), τόση ακριβώς δεν επενδύεται.
    expect(z.gradeAbsMm).toBe(0);
    expect(z.buriedHeightMm).toBe(GROUND_FLOOR_COLUMN.baseDropMm);
    expect(z.buriedBottomAbsMm).toBe(-1000);
    expect(z.exposedHeightMm).toBe(3000);
  });

  it('χαμηλότερη στάθμη → μικρότερη θαμμένη ζώνη, το κοντόστυλο ΜΕΝΕΙ 1000', () => {
    const z = resolveColumnExposureZones({ ...GROUND_FLOOR_COLUMN, gradeAbsMm: -300 });
    expect(z.buriedHeightMm).toBe(700);
    expect(z.exposedHeightMm).toBe(3300);
    expect(z.buriedBottomAbsMm).toBe(-1000); // ADR-712 όριο όγκου — αμετάβλητο
  });
});

describe('resolveColumnExposureZones — clamp', () => {
  it('επικλινές: έδαφος ΠΑΝΩ από το FFL θάβει και τμήμα ανωδομής', () => {
    const z = resolveColumnExposureZones({ ...GROUND_FLOOR_COLUMN, gradeAbsMm: 500 });
    expect(z.gradeAbsMm).toBe(500);
    expect(z.buriedHeightMm).toBe(1500); // 1000 κοντόστυλο + 500 ανωδομής
    expect(z.exposedHeightMm).toBe(2500);
  });

  it('έδαφος πάνω από την κορυφή → clamp στην κορυφή (καμία ζώνη-φάντασμα)', () => {
    const z = resolveColumnExposureZones({ ...GROUND_FLOOR_COLUMN, gradeAbsMm: 9999 });
    expect(z.gradeAbsMm).toBe(3000);
    expect(z.exposedHeightMm).toBe(0);
    expect(z.buriedHeightMm).toBe(4000);
  });

  it('έδαφος κάτω από το πέδιλο → clamp στο πέδιλο (ποτέ ζώνη εκτός στερεού)', () => {
    const z = resolveColumnExposureZones({ ...GROUND_FLOOR_COLUMN, gradeAbsMm: -5000 });
    expect(z.gradeAbsMm).toBe(-1000);
    expect(z.buriedHeightMm).toBe(0);
    expect(z.exposedHeightMm).toBe(4000);
  });

  it('αρνητικό baseDropMm → clamp στο 0 (πέδιλο ψηλότερα δεν αφαιρεί κολώνα)', () => {
    const z = resolveColumnExposureZones({ ...GROUND_FLOOR_COLUMN, baseDropMm: -400 });
    expect(z.buriedBottomAbsMm).toBe(0);
    expect(z.buriedHeightMm).toBe(0);
  });
});

describe('resolveColumnExposureZones — legacy / degenerate', () => {
  it('κολώνα ορόφου (καμία έδραση, καμία ρύθμιση) → ΜΗΔΕΝ θαμμένη ζώνη', () => {
    const z = resolveColumnExposureZones({ nominalBaseAbsMm: 3000, topAbsMm: 6000, baseDropMm: 0 });
    expect(z.buriedHeightMm).toBe(0);
    expect(z.exposedHeightMm).toBe(3000); // πλήρες ύψος → ο caller κρατά το legacy μονοπάτι
    expect(hasBuriedZone(z)).toBe(false);
  });

  it('sliver κάτω από το κατώφλι απορρίπτεται ΧΩΡΙΣ να χαθεί ύψος', () => {
    const drop = MIN_EXPOSURE_ZONE_MM / 2;
    const z = resolveColumnExposureZones({ nominalBaseAbsMm: 0, topAbsMm: 3000, baseDropMm: drop });
    expect(z.buriedHeightMm).toBe(0);
    // Το ολικό στερεό είναι 3000 + drop· όλο πάει στην εκτεθειμένη ζώνη, τίποτα δεν εξαφανίζεται.
    expect(z.exposedHeightMm).toBeCloseTo(3000 + drop, 9);
  });

  it('τα δύο ύψη αθροίζουν ΠΑΝΤΑ στο συνολικό στερεό', () => {
    for (const gradeAbsMm of [-5000, -1000, -700, 0, 500, 3000, 9999]) {
      const z = resolveColumnExposureZones({ ...GROUND_FLOOR_COLUMN, gradeAbsMm });
      expect(z.buriedHeightMm + z.exposedHeightMm).toBeCloseTo(4000, 9);
    }
  });

  it('NaN/Infinity → fail-safe στο default (ποτέ NaN έξω)', () => {
    const z = resolveColumnExposureZones({
      nominalBaseAbsMm: Number.NaN,
      topAbsMm: Number.POSITIVE_INFINITY,
      baseDropMm: Number.NaN,
      gradeAbsMm: Number.NaN,
    });
    expect(Number.isFinite(z.gradeAbsMm)).toBe(true);
    expect(Number.isFinite(z.buriedHeightMm)).toBe(true);
    expect(z.buriedHeightMm).toBe(0);
  });

  it('εκφυλισμένη κολώνα (κορυφή κάτω από τη βάση) δεν παράγει αρνητικά ύψη', () => {
    const z = resolveColumnExposureZones({ nominalBaseAbsMm: 0, topAbsMm: -500, baseDropMm: 0 });
    expect(z.buriedHeightMm).toBeGreaterThanOrEqual(0);
    expect(z.exposedHeightMm).toBeGreaterThanOrEqual(0);
  });
});
