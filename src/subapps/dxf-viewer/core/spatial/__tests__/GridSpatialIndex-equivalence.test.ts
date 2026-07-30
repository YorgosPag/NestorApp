/**
 * ADR-735 — **συμπεριφορική ισοδυναμία 100%** του ξαναγραμμένου `getCandidates` (ADR-728 §6).
 *
 * ## Γιατί δεν αρκεί «ίδιο σύνολο»
 *
 * Το `BaseSpatialIndex.finalizeResults` ταξινομεί κατά απόσταση με `Array.sort`, που είναι
 * **σταθερό** (ES2019): δύο snap points στην **ίδια ακριβώς** απόσταση κρατούν τη σειρά εισαγωγής
 * ⇒ **νικά όποιο συναντήθηκε πρώτο κατά τη σάρωση των κελιών**. Ένα «γρήγορο» `getCandidates` που
 * επιστρέφει το ίδιο σύνολο με **άλλη σειρά** αλλάζει σιωπηλά σε ποιο σημείο κουμπώνει ο κέρσορας.
 * Αυτό είναι παλινδρόμηση **ορθότητας**, όχι απόδοσης — και δεν φαίνεται σε κανένα test συνόλου.
 *
 * ## Το oracle
 *
 * Η {@link buildOracle} αναπαράγει την **προ-ADR-735** υλοποίηση αυτούσια: string κλειδιά
 * `` `${col},${row}` ``, σάρωση ολόκληρου του ορθογωνίου, col-major (`for col { for row } }`),
 * dedup με `Map` (πρώτη εμφάνιση κερδίζει). Είναι η γραπτή μορφή του «τι έκανε πριν».
 *
 * ## Και τα ΔΥΟ μονοπάτια
 *
 * Το νέο `getCandidates` διαλέγει ανάμεσα σε σάρωση παραθύρου και σάρωση κατοικημένων κελιών
 * (`windowCells <= populatedCells`). Ένα test που χτυπά μόνο το ένα αφήνει το άλλο **ακάλυπτο** —
 * γι' αυτό τα σενάρια είναι φτιαγμένα ώστε να εξαναγκάζουν το καθένα, και το test **επαληθεύει
 * ρητά ποιο ενεργοποιήθηκε** αντί να το υποθέτει.
 */

import { GridSpatialIndex } from '../GridSpatialIndex';
import type { SpatialBounds, SpatialItem } from '../ISpatialIndex';

/** Εκθέτει το `protected getCandidates` — η σειρά του είναι το αντικείμενο του ελέγχου. */
class ProbeGrid extends GridSpatialIndex {
  candidateIds(bounds: SpatialBounds): string[] {
    return this.getCandidates(bounds).map((item) => item.id);
  }
  get populatedCellCount(): number {
    const structure = this.debug().structure as { cellCount: number };
    return structure.cellCount;
  }
}

const clampInt = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const intersects = (a: SpatialBounds, b: SpatialBounds) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

/**
 * Η προ-ADR-735 σημασιολογία, γραμμένη ρητά: string κλειδιά, col-major σάρωση, dedup «πρώτη
 * εμφάνιση». Χτίζεται **μία φορά ανά κλίμακα κελιού** και ερωτάται πολλές — όπως και ο ίδιος ο
 * index, ώστε το differential να μετρά την **ερώτηση**, όχι το χτίσιμο.
 */
function buildOracle(
  items: readonly SpatialItem[],
  indexBounds: SpatialBounds,
  cellSize: number,
): (query: SpatialBounds) => string[] {
  const cols = Math.ceil((indexBounds.maxX - indexBounds.minX) / cellSize);
  const rows = Math.ceil((indexBounds.maxY - indexBounds.minY) / cellSize);
  const colOf = (x: number) => clampInt(Math.floor((x - indexBounds.minX) / cellSize), 0, cols - 1);
  const rowOf = (y: number) => clampInt(Math.floor((y - indexBounds.minY) / cellSize), 0, rows - 1);

  const cells = new Map<string, SpatialItem[]>();
  for (const item of items) {
    for (let c = colOf(item.bounds.minX); c <= colOf(item.bounds.maxX); c++) {
      for (let r = rowOf(item.bounds.minY); r <= rowOf(item.bounds.maxY); r++) {
        const key = `${c},${r}`;
        const bucket = cells.get(key) ?? [];
        if (!bucket.some((existing) => existing.id === item.id)) bucket.push(item);
        cells.set(key, bucket);
      }
    }
  }

  return (query: SpatialBounds): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let c = colOf(query.minX); c <= colOf(query.maxX); c++) {
      for (let r = rowOf(query.minY); r <= rowOf(query.maxY); r++) {
        for (const item of cells.get(`${c},${r}`) ?? []) {
          if (!intersects(item.bounds, query) || seen.has(item.id)) continue;
          seen.add(item.id);
          out.push(item.id);
        }
      }
    }
    return out;
  };
}

const pointItem = (id: string, x: number, y: number): SpatialItem =>
  ({ id, bounds: { minX: x, minY: y, maxX: x, maxY: y }, data: { point: { x, y } } });

/** Ντετερμινιστικός LCG — `Math.random` θα έκανε μια αποτυχία μη αναπαραγώγιμη. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function buildBoth(items: readonly SpatialItem[], bounds: SpatialBounds, cellSize: number) {
  const grid = new ProbeGrid(bounds, cellSize);
  for (const item of items) grid.insert(item);
  return grid;
}

describe('ADR-735 — getCandidates: ίδιο σύνολο ΚΑΙ ίδια σειρά με την προ-ADR-735 σάρωση', () => {
  const bounds: SpatialBounds = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };

  it('🔴 ισοβαθμίες: 4 σημεία σε ΙΔΙΑ απόσταση σέβονται τη σειρά col-major', () => {
    // Ο μόνος τρόπος να αλλάξει σιωπηλά ο νικητής του snap.
    const items = [
      pointItem('east', 500, 0),
      pointItem('north', 0, 500),
      pointItem('west', -500, 0),
      pointItem('south', 0, -500),
    ];
    // Σειρά ΕΙΣΑΓΩΓΗΣ ≠ σειρά ΕΞΟΔΟΥ: η έξοδος πρέπει να είναι γεωμετρική (col, μετά row).
    const query: SpatialBounds = { minX: -600, minY: -600, maxX: 600, maxY: 600 };

    for (const cellSize of [10, 50, 137]) {
      const grid = buildBoth(items, bounds, cellSize);
      expect(grid.candidateIds(query)).toEqual(buildOracle(items, bounds, cellSize)(query));
      // …και είναι όντως δυτικά→ανατολικά, όχι η σειρά εισαγωγής.
      expect(grid.candidateIds(query)).toEqual(['west', 'south', 'north', 'east']);
    }
  });

  it('μονοπάτι ΠΑΡΑΘΥΡΟΥ (πυκνά δεδομένα, μικρή ακτίνα)', () => {
    const items: SpatialItem[] = [];
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 40; j++) items.push(pointItem(`p${i}_${j}`, -800 + i * 40, -800 + j * 40));
    }
    const cellSize = 25;
    const grid = buildBoth(items, bounds, cellSize);
    const query: SpatialBounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 };

    const windowCells = Math.pow(Math.floor(200 / cellSize) + 1, 2);
    expect(windowCells).toBeLessThanOrEqual(grid.populatedCellCount); // ⇒ σάρωση παραθύρου
    expect(grid.candidateIds(query)).toEqual(buildOracle(items, bounds, cellSize)(query));
  });

  it('μονοπάτι ΚΑΤΟΙΚΗΜΕΝΩΝ (αραιά δεδομένα, ακτίνα zoom-out)', () => {
    // Ακριβώς το σενάριο παραγωγής: λίγα σημεία, τεράστιο aperture σε world units.
    const items = [pointItem('a', -900, -900), pointItem('b', 0, 0), pointItem('c', 900, 900)];
    const cellSize = 2; // ⇒ 1000×1000 κελιά παραθύρου έναντι 3 κατοικημένων
    const grid = buildBoth(items, bounds, cellSize);
    const query: SpatialBounds = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };

    expect(grid.populatedCellCount).toBe(3);
    expect(grid.candidateIds(query)).toEqual(buildOracle(items, bounds, cellSize)(query));
    expect(grid.candidateIds(query)).toEqual(['a', 'b', 'c']);
  });

  it('differential: 200 τυχαία (seeded) ερωτήματα × 4 κλίμακες κελιού — και τα δύο μονοπάτια', () => {
    const rand = seeded(0xC0FFEE);
    const items: SpatialItem[] = [];
    for (let i = 0; i < 300; i++) {
      items.push(pointItem(`r${i}`, rand() * 2000 - 1000, rand() * 2000 - 1000));
    }
    // Items με ΕΚΤΑΣΗ (πολλαπλά κελιά) — εκεί το dedup «πρώτη εμφάνιση» έχει σημασία.
    for (let i = 0; i < 20; i++) {
      const x = rand() * 1600 - 800;
      const y = rand() * 1600 - 800;
      items.push({ id: `box${i}`, bounds: { minX: x, minY: y, maxX: x + 150, maxY: y + 150 } });
    }

    let sawWindowPath = false;
    let sawPopulatedPath = false;

    for (const cellSize of [3, 25, 100, 400]) {
      const grid = buildBoth(items, bounds, cellSize);
      const oracle = buildOracle(items, bounds, cellSize);
      for (let q = 0; q < 50; q++) {
        const cx = rand() * 2000 - 1000;
        const cy = rand() * 2000 - 1000;
        const radius = [5, 60, 400, 1500][q % 4];
        const query: SpatialBounds = {
          minX: cx - radius, minY: cy - radius, maxX: cx + radius, maxY: cy + radius,
        };

        const span = Math.floor((2 * radius) / cellSize) + 1;
        if (span * span <= grid.populatedCellCount) sawWindowPath = true;
        else sawPopulatedPath = true;

        expect(grid.candidateIds(query)).toEqual(oracle(query));
      }
    }

    // Χωρίς αυτό, ένα από τα δύο μονοπάτια θα μπορούσε να είναι μονίμως ανεκτέλεστο.
    expect(sawWindowPath).toBe(true);
    expect(sawPopulatedPath).toBe(true);
  });
});

describe('ADR-735 — το κόστος δεν ακολουθεί πλέον το zoom', () => {
  it('ίδια δεδομένα, aperture ×100: ο χρόνος δεν εκρήγνυται', () => {
    // Η ρίζα του ευρήματος: πριν, το κόστος ήταν Ο((2·radius/cellSize)²) — δηλαδή Ο(zoom²) με
    // ΜΗΔΕΝΙΚΗ εξάρτηση από τα δεδομένα. 62.500 κελιά για 15-76 σημεία, 16-19ms ανά κλήση.
    const bounds: SpatialBounds = { minX: 0, minY: 0, maxX: 200_000, maxY: 200_000 };
    const items: SpatialItem[] = [];
    const rand = seeded(42);
    for (let i = 0; i < 3000; i++) items.push(pointItem(`p${i}`, rand() * 200_000, rand() * 200_000));

    // Πλευρά κελιού από τον SSoT (⌈√3000⌉ = 55) — όχι το πάγιο 50 world units.
    const grid = buildBoth(items, bounds, 200_000 / 55);

    const timeAt = (radius: number): number => {
      const start = performance.now();
      for (let i = 0; i < 200; i++) {
        const c = (i * 7919) % 200_000;
        grid.candidateIds({ minX: c - radius, minY: c - radius, maxX: c + radius, maxY: c + radius });
      }
      return performance.now() - start;
    };

    timeAt(62); // προθέρμανση (JIT) — αλλιώς μετράμε τον compiler
    const tight = Math.max(timeAt(62), 0.5);   // zoom-in
    const wide = timeAt(6_220);                // 1:2352, το σενάριο παραγωγής

    // Προ-ADR-735 η αναλογία ήταν ~×1250 (0,006ms → 7,5ms, μετρημένο).
    expect(wide / tight).toBeLessThan(60);
  });
});
