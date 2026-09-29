/**
 * ADR-884 §4.14 Γ3γ-2β «Σύμβολο πόρτας στο όριο» — το τόξο + φύλλο δεν ορίζουν χώρο (Revit: η πόρτα δεν είναι room-bounding),
 * ενώ ο πραγματικός τοίχος (έρκερ, παραστάδα, κοντός τοίχος, κολόνα) ΜΕΝΕΙ.
 *
 * 🔑 Τα δαχτυλίδια «πραγματικό» είναι **μετρημένα** (m) από την κάτοψη του ακινήτου `prop_48a7caf6…` (w1024, 0,01828 m/px) —
 *   το περίγραμμα μετά το Douglas–Peucker, ΠΡΙΝ την απορρόφηση, με το ρυθμιστικό πόρτας στο 1,0 και στο 2,0 m.
 */

import { dominantAxis, DEFAULT_ORTHOGONAL_SNAP } from '@/lib/geometry/orthogonal-snap';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { absorbDoorSymbols, type DoorSymbolLimits } from '../door-symbol-absorb';

const ring = (text: string): PlanarPoint[] => text.trim().split(/\s+/).map((pair) => {
  const [x, y] = pair.split(',').map(Number);
  return { x, y };
});

const limits = (r: readonly PlanarPoint[], doorWidthM = 1.0): DoorSymbolLimits => ({
  axisRad: dominantAxis(r),
  toleranceRad: DEFAULT_ORTHOGONAL_SNAP.toleranceRad,
  noise: 0.05,
  anchorMin: 0.15,
  reach: doorWidthM + 0.2,
  revealMax: 0.2,
});

const has = (r: readonly PlanarPoint[], x: number, y: number): boolean =>
  r.some((p) => Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01);

/** Γραφείο — τόξο (δαγκώνει τη γωνία) + εγκοπή κάτω από το κλειστό φύλλο · πάνω αριστερά λοξός τοίχος έρκερ 1,96 m. */
const OFFICE_1M = ring(`5.858,0.905 8.106,0.905 8.106,3.774 7.868,4.158 7.411,4.322 7.448,4.396 7.868,4.396 7.813,4.450
  7.320,4.450 7.283,4.286 5.163,4.304 5.163,2.787`);
const OFFICE_2M = ring(`5.858,0.905 8.106,0.905 8.106,3.774 7.868,4.158 7.411,4.322 7.448,4.396 8.069,4.396 8.014,4.450
  7.320,4.450 7.283,4.286 5.163,4.304 5.163,2.787`);
/** Σαλόνι — πόρτα εισόδου αριστερά (τόξο + ανοιχτό φύλλο) δίπλα σε παραστάδα · κοντός τοίχος 13 cm πάνω · άνοιγμα δεξιά πάνω. */
const HALL_1M = ring(`9.093,4.359 9.129,4.597 9.952,4.597 10.061,4.706 10.061,5.273 10.135,5.437 9.751,5.437 9.696,5.565
  9.714,11.323 5.163,11.341 5.181,8.142 5.492,7.667 6.059,7.466 6.041,7.393 5.346,7.393 5.236,7.283 5.419,7.265 5.419,7.027
  5.163,6.991 5.163,4.597 8.106,4.597 8.106,5.163 8.234,5.200 8.270,4.597 8.618,4.597 8.764,4.450`);
const HALL_2M = ring(`8.727,4.012 9.111,4.396 9.111,4.578 9.312,4.597 10.153,5.437 9.751,5.437 9.696,5.565 9.714,11.323
  5.163,11.341 5.181,8.142 5.492,7.667 6.059,7.466 6.041,7.393 5.163,7.393 5.163,7.283 5.419,7.265 5.419,7.027 5.163,6.991
  5.163,4.597 8.106,4.597 8.106,5.163 8.234,5.200 8.270,4.432 8.106,4.304 8.270,4.140`);

describe('absorbDoorSymbols — πραγματική κάτοψη', () => {
  it('Γραφείο: τόξο + εγκοπή ⇒ ΜΙΑ γωνία στην παρειά (12 → 5 κορυφές) · το έρκερ ΜΕΝΕΙ', () => {
    const out = absorbDoorSymbols(OFFICE_1M, limits(OFFICE_1M));
    expect(out).toHaveLength(5);
    expect(has(out, 8.106, 4.279)).toBe(true);
    expect(has(out, 5.163, 2.787) && has(out, 5.858, 0.905)).toBe(true);
    expect(out.some((p) => p.y > 4.31)).toBe(false);
  });

  it('Γραφείο με πόρτα 2 m (μεγαλύτερη εμβέλεια): το έρκερ — ΜΙΑ λοξή ακμή 1,96 m — ΔΕΝ «ισιώνει»', () => {
    const out = absorbDoorSymbols(OFFICE_2M, limits(OFFICE_2M, 2.0));
    expect(out).toHaveLength(5);
    expect(has(out, 5.163, 2.787) && has(out, 5.858, 0.905)).toBe(true);
  });

  it('Σαλόνι: η πόρτα εισόδου απορροφάται · η ΠΑΡΑΣΤΑΔΑ (Π 25 cm) και ο κοντός τοίχος ΜΕΝΟΥΝ', () => {
    const out = absorbDoorSymbols(HALL_1M, limits(HALL_1M));
    expect(has(out, 6.059, 7.466)).toBe(false);
    expect(has(out, 5.419, 7.265) && has(out, 5.419, 7.027)).toBe(true);
    expect(has(out, 8.106, 5.163) && has(out, 8.234, 5.200)).toBe(true);
    expect(out.every((p) => p.x <= 9.72)).toBe(true);
  });

  it('Σαλόνι με πόρτα 2 m: ο κοντός τοίχος (κάτω παρειά 13 cm, μετρημένη στις 16°) ΜΕΝΕΙ — θόρυβος DP, όχι λοξή ακμή', () => {
    const out = absorbDoorSymbols(HALL_2M, limits(HALL_2M, 2.0));
    expect(has(out, 8.106, 5.163) && has(out, 8.234, 5.200)).toBe(true);
    expect(has(out, 5.419, 7.265) && has(out, 5.419, 7.027)).toBe(true);
    expect(has(out, 6.059, 7.466)).toBe(false);
    // Το άνοιγμα πάνω δεξιά (ο τοίχος «περισσεύει» μία παρειά μέσα του) κλείνει στη γωνία — τίποτα πάνω από την παρειά.
    expect(out.every((p) => p.y >= 4.4)).toBe(true);
  });

  it('άνοιγμα στη ΜΕΣΗ τοίχου: τσέπη-Π ΠΡΟΣ ΤΑ ΕΞΩ (πάχος τοίχου) + τόξο ⇒ ο τοίχος συνεχίζει ίσιος', () => {
    const r = ring('0,0 4,0 4,2 4.15,2 4.15,2.4 4,2.4 3.6,2.55 3.5,2.8 4,3 4,6 0,6');
    const out = absorbDoorSymbols(r, limits(r));
    expect(out).toHaveLength(6);
    expect(ring('0,0 4,0 4,2 4,3 4,6 0,6').every((p) => has(out, p.x, p.y))).toBe(true);
  });

  it('ιδεμποτές: δεύτερο πέρασμα επιστρέφει την ΙΔΙΑ αναφορά', () => {
    const once = absorbDoorSymbols(OFFICE_1M, limits(OFFICE_1M));
    expect(absorbDoorSymbols(once, limits(once))).toBe(once);
  });
});

describe('absorbDoorSymbols — το πραγματικό σχήμα μένει ΑΘΙΚΤΟ (ίδια αναφορά)', () => {
  it('Γ-σχήμα με κολόνα 30 cm (όλα σε άξονες)', () => {
    const r = ring('0,0 6,0 6,3 3,3 3,5 0,5 0,2.3 0.3,2.3 0.3,2 0,2');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('λοξοτμημένη γωνία — ΜΙΑ λοξή ακμή 0,5 m ανάμεσα σε δύο τοίχους', () => {
    const r = ring('0,0 4,0 4,3.65 3.65,4 0,4');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('λοξοτμημένη γωνία 1,6 m από ΤΡΕΙΣ λοξές ακμές (καθεμία < πόρτα) — οι άκρες της ΠΕΡΑ από την εμβέλεια', () => {
    const r = ring('0,0 4,0 4,2.4 3.75,3.25 3.25,3.75 2.4,4 0,4');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('έρκερ από ΔΥΟ λοξές ακμές 1,5 m — καθεμία μακρύτερη από την πόρτα (λοξός τοίχος, όχι τόξο)', () => {
    const r = ring('0,-2 4,-2 4,0 4.6,1.4 4,2.8 4,5 0,5');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('λοξός τοίχος 1,25 m (μακρύτερος από την πόρτα) + μικρή επιστροφή στη γωνία — όλες οι κορυφές ΜΕΣΑ στην εμβέλεια', () => {
    const r = ring('0,0 4,0 4,3 2.9,3.6 3,4 0,4');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('έρκερ 2 m από ΤΡΕΙΣ κοντές λοξές ακμές (< πόρτα) — πλατύτερο από κάθε άνοιγμα πόρτας', () => {
    const r = ring('0,-2 4,-2 4,0 4.4,0.6 4.4,1.4 4,2 4,5 0,5');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('λεπτός τοίχος 15 cm με λοξή μύτη: οι δύο πλευρές του είναι ΑΝΤΙΡΡΟΠΕΣ — ποτέ «συνέχεια» η μία της άλλης', () => {
    const r = ring('-3,-3 3,-3 3,3 0.15,3 0.15,1.1 0.08,1.2 0,1 0,3 -3,3');
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });

  it('καμπύλο κομμάτι ΠΕΡΑ από την εμβέλεια της πόρτας (τόξο ακτίνας 2 m, πόρτα 1 m)', () => {
    const arc = [0.3, 0.6, 0.9, 1.2].map((a) => `${(4 - 2 + 2 * Math.cos(a)).toFixed(3)},${(4 - 2 + 2 * Math.sin(a)).toFixed(3)}`);
    const r = ring(`0,0 4,0 4,2 ${arc.join(' ')} 2,4 0,4`);
    expect(absorbDoorSymbols(r, limits(r))).toBe(r);
  });
});
