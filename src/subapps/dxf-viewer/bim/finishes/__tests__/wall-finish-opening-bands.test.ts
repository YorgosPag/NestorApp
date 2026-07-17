/**
 * ADR-449 §opening-bands — ο σοβάς τοίχου σέβεται τα ανοίγματα (Giorgio 2026-07-17).
 *
 * Επαληθεύει: (1) **χωρίς ανοίγματα → 1 member, ταυτόσημο footprint** (byte-for-byte guard της
 * προ-opening-bands συμπεριφοράς), (2) παράθυρο → 3 z-bands με το μεσαίο τρυπημένο, (3) πόρτα
 * (sill 0) → 2 bands, (4) dedup κοινών sill/header, (5) εκφυλισμένα/εκτός ανοίγματα → no-op.
 */

import { splitFootprintByOpeningBands, type SilhouetteOpeningSource } from '../wall-finish-opening-bands';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

/** Τοίχος (0,0)→(3000,0), πάχος 250 → κεντραρισμένο footprint. Canvas units = mm. */
const WALL_FOOTPRINT: Pt2[] = [
  { x: 0, y: -125 },
  { x: 3000, y: -125 },
  { x: 3000, y: 125 },
  { x: 0, y: 125 },
];
const FULL_Z = { zBotMm: 0, zTopMm: 3000 };

/**
 * Άνοιγμα ως cutter. Το outline τέμνει **όλο** το πάχος (y −125..125) όπως το πραγματικό cutout —
 * αλλιώς θα ήταν τρύπα-εντός-πολυγώνου και το outer ring θα έμενε ανέπαφο.
 */
function opening(
  x0: number,
  x1: number,
  sillHeight: number,
  height: number,
): SilhouetteOpeningSource {
  return {
    params: { sillHeight, height },
    geometry: {
      outline: {
        vertices: [
          { x: x0, y: -125 },
          { x: x1, y: -125 },
          { x: x1, y: 125 },
          { x: x0, y: 125 },
        ],
      },
    },
  };
}

/** Τα x-όρια ενός ring (για να ταυτοποιούμε ποιο jamb είναι ποιο). */
function xRange(fp: readonly Pt2[]): [number, number] {
  const xs = fp.map((p) => p.x);
  return [Math.min(...xs), Math.max(...xs)];
}

describe('ADR-449 §opening-bands — splitFootprintByOpeningBands', () => {
  it('ΧΩΡΙΣ ανοίγματα → 1 member, footprint ΑΥΤΟΥΣΙΟ (byte-for-byte guard)', () => {
    for (const ops of [undefined, []]) {
      const ms = splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, ops);
      expect(ms).toHaveLength(1);
      expect(ms[0].footprint).toBe(WALL_FOOTPRINT); // ίδια αναφορά — μηδέν round-trip
      expect(ms[0].zBotMm).toBe(0);
      expect(ms[0].zTopMm).toBe(3000);
    }
  });

  it('παράθυρο (sill 900, ύψος 1200) → 3 bands· ΜΟΝΟ το μεσαίο τρυπημένο (2 jambs)', () => {
    const ms = splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [opening(1000, 2000, 900, 1200)]);

    // ποδιά 0–900 (πλήρες) + άνοιγμα 900–2100 (2 jambs) + πρέκι 2100–3000 (πλήρες) = 4 members.
    expect(ms).toHaveLength(4);

    const sill = ms.filter((m) => m.zBotMm === 0);
    expect(sill).toHaveLength(1);
    expect(sill[0].zTopMm).toBe(900);
    expect(sill[0].footprint).toBe(WALL_FOOTPRINT); // κάτω από το παράθυρο → άθικτο

    const header = ms.filter((m) => m.zBotMm === 2100);
    expect(header).toHaveLength(1);
    expect(header[0].zTopMm).toBe(3000);
    expect(header[0].footprint).toBe(WALL_FOOTPRINT); // πάνω από το παράθυρο → άθικτο

    // Η ζώνη του κουφώματος: ο τοίχος έχει σπάσει σε δύο jambs, το κενό ΔΕΝ σοβατίζεται.
    const punched = ms.filter((m) => m.zBotMm === 900);
    expect(punched).toHaveLength(2);
    for (const p of punched) expect(p.zTopMm).toBe(2100);
    const ranges = punched.map((p) => xRange(p.footprint)).sort((a, b) => a[0] - b[0]);
    expect(ranges[0]).toEqual([0, 1000]);
    expect(ranges[1]).toEqual([2000, 3000]);
  });

  it('πόρτα (sill 0, ύψος 2100) → 2 bands (κανένα ποδιά-band)', () => {
    const ms = splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [opening(1000, 2000, 0, 2100)]);
    // άνοιγμα 0–2100 (2 jambs) + πρέκι 2100–3000 (πλήρες) = 3 members. Μηδέν band κάτω από την πόρτα.
    expect(ms).toHaveLength(3);
    expect(ms.filter((m) => m.zBotMm === 0)).toHaveLength(2);
    const header = ms.filter((m) => m.zBotMm === 2100);
    expect(header).toHaveLength(1);
    expect(header[0].footprint).toBe(WALL_FOOTPRINT);
  });

  it('2 παράθυρα ΙΔΙΟΥ sill/header → dedup breakpoints (3 bands, όχι 5)', () => {
    const ms = splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [
      opening(500, 1000, 900, 1200),
      opening(2000, 2500, 900, 1200),
    ]);
    // Τα z-όρια συμπίπτουν → ΕΝΑ punched band με 3 κομμάτια (0–500, 1000–2000, 2500–3000).
    const zPairs = new Set(ms.map((m) => `${m.zBotMm}-${m.zTopMm}`));
    expect([...zPairs].sort()).toEqual(['0-900', '2100-3000', '900-2100']);
    expect(ms.filter((m) => m.zBotMm === 900)).toHaveLength(3);
  });

  it('άνοιγμα ΕΚΤΟΣ footprint → identity (πλήρες, μηδέν round-trip)', () => {
    const ms = splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [opening(9000, 9500, 900, 1200)]);
    // Τα z-bands σπάνε (το άνοιγμα υπάρχει), αλλά κανένα footprint δεν τρυπιέται.
    for (const m of ms) expect(m.footprint).toBe(WALL_FOOTPRINT);
  });

  it('εκφυλισμένο outline (<3 κορυφές) / μηδενικό ύψος → αγνοείται (1 member)', () => {
    const degenerate: SilhouetteOpeningSource = {
      params: { sillHeight: 900, height: 1200 },
      geometry: { outline: { vertices: [{ x: 1000, y: 0 }] } },
    };
    expect(splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [degenerate])).toHaveLength(1);
    // Ύψος 0 → κανένα band να τρυπηθεί.
    expect(splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [opening(1000, 2000, 900, 0)])).toHaveLength(1);
  });

  it('άνοιγμα ψηλότερα από τον τοίχο → clamp στην κορυφή (κανένα band πάνω από τον τοίχο)', () => {
    // sill 2500 + ύψος 1200 → head 3700 > τοίχος 3000 ⇒ clamp: bands 0–2500, 2500–3000 (τρυπημένο).
    const ms = splitFootprintByOpeningBands(WALL_FOOTPRINT, FULL_Z, [opening(1000, 2000, 2500, 1200)]);
    expect(Math.max(...ms.map((m) => m.zTopMm))).toBe(3000);
    expect(ms.filter((m) => m.zBotMm === 2500).length).toBeGreaterThan(1); // τρυπημένο → jambs
  });
});
