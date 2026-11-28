/**
 * ADR-920 §14.12 Β3.1 — το πλέγμα μιας απεικόνισης: φθηνή ανάγνωση, με σφάλμα ΜΕΤΡΗΜΕΝΟ απέναντι στην ακριβή.
 *
 * Οι απεικονίσεις είναι τύποι με γνωστή καμπυλότητα, ώστε το πόσο πρέπει να πυκνώσει το πλέγμα να βγαίνει από τον τύπο.
 */

import { createPlanarMapLattice, type ExactPlanarMap, type PlanarMapDomain } from '../planar-map-lattice';

const DOMAIN: PlanarMapDomain = { minU: 2, minV: -1, maxU: 6, maxV: 3 };

/** Αφινική + όρος `u·v`: ακριβώς ό,τι αναπαράγει η διγραμμική ανάγνωση. */
const bilinear: ExactPlanarMap = (u, v) => ({ x: 3 + 2 * u - v + 0.5 * u * v, y: -7 + 0.25 * u + 4 * v - 0.1 * u * v });

/** Καμπύλη: τετραγωνικοί όροι με αντίθετα πρόσημα στο `x` (το σφάλμα κορυφώνεται σε μέσο πλευράς, όχι στο κέντρο). */
const curved: ExactPlanarMap = (u, v) => ({ x: u + 0.01 * u * u - 0.01 * v * v, y: v + 0.02 * Math.sin(u) * Math.cos(v) });

/** Σημεία που δεν είναι ούτε κόμβοι ούτε δοκιμές κανενός πλέγματος (άρρητα βήματα). */
function scattered(count: number): { u: number; v: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    u: DOMAIN.minU + (DOMAIN.maxU - DOMAIN.minU) * ((i * Math.SQRT2) % 1),
    v: DOMAIN.minV + (DOMAIN.maxV - DOMAIN.minV) * ((i * Math.E) % 1),
  }));
}

function worstErrorOf(exact: ExactPlanarMap, read: (sink: { x: number; y: number }, u: number, v: number) => void): number {
  const sink = { x: 0, y: 0 };
  let worst = 0;
  for (const { u, v } of scattered(2000)) {
    read(sink, u, v);
    const truth = exact(u, v);
    worst = Math.max(worst, Math.hypot(sink.x - truth.x, sink.y - truth.y));
  }
  return worst;
}

describe('createPlanarMapLattice', () => {
  it('διγραμμική απεικόνιση: ένα κελί αρκεί, και η ανάγνωση είναι η ίδια η απεικόνιση', () => {
    const lattice = createPlanarMapLattice(bilinear, DOMAIN, 1e-9);
    if (lattice === null) throw new Error('expected a lattice');
    expect(lattice.cellsPerAxis).toBe(1);
    expect(worstErrorOf(bilinear, lattice.mapInto)).toBeLessThan(1e-12);
  });

  it('καμπύλη απεικόνιση: πυκνώνει ώσπου το ΜΕΤΡΗΜΕΝΟ σφάλμα να πέσει στο μισό της ανοχής — και όχι παραπέρα', () => {
    const tolerance = 1e-4;
    const lattice = createPlanarMapLattice(curved, DOMAIN, tolerance);
    if (lattice === null) throw new Error('expected a lattice');
    expect(lattice.cellsPerAxis).toBeGreaterThan(1);
    expect(lattice.measuredError).toBeLessThanOrEqual(tolerance / 2);
    expect(lattice.measuredError).toBeGreaterThan(0);
    // Το μισό τόσο πυκνό πλέγμα ΔΕΝ περνά: το πλέγμα που γύρισε είναι το αραιότερο που αρκεί.
    const coarser = createPlanarMapLattice(curved, DOMAIN, tolerance, lattice.cellsPerAxis / 2);
    expect(coarser).toBeNull();
  });

  it('ανάμεσα στις δοκιμές: σε 2.000 άσχετα σημεία το σφάλμα μένει μέσα στην ανοχή', () => {
    for (const tolerance of [1e-2, 1e-3, 1e-4]) {
      const lattice = createPlanarMapLattice(curved, DOMAIN, tolerance);
      if (lattice === null) throw new Error(`expected a lattice for ${tolerance}`);
      expect(worstErrorOf(curved, lattice.mapInto)).toBeLessThan(tolerance);
    }
  });

  it('στους κόμβους η ανάγνωση είναι η ακριβής τιμή, και στις γωνίες του πεδίου', () => {
    const lattice = createPlanarMapLattice(curved, DOMAIN, 1e-4);
    if (lattice === null) throw new Error('expected a lattice');
    const sink = { x: 0, y: 0 };
    for (const [u, v] of [[DOMAIN.minU, DOMAIN.minV], [DOMAIN.maxU, DOMAIN.minV], [DOMAIN.minU, DOMAIN.maxV], [DOMAIN.maxU, DOMAIN.maxV]]) {
      lattice.mapInto(sink, u, v);
      const truth = curved(u, v);
      expect(sink.x).toBeCloseTo(truth.x, 12);
      expect(sink.y).toBeCloseTo(truth.y, 12);
    }
  });

  it('καθαρή συνάρτηση του σημείου: η ίδια ερώτηση δίνει τα ίδια bits, ό,τι κι αν ρωτήθηκε πριν', () => {
    const lattice = createPlanarMapLattice(curved, DOMAIN, 1e-4);
    if (lattice === null) throw new Error('expected a lattice');
    const first = { x: 0, y: 0 };
    const again = { x: 0, y: 0 };
    lattice.mapInto(first, 3.21, 0.77);
    for (const { u, v } of scattered(50)) lattice.mapInto(again, u, v);
    lattice.mapInto(again, 3.21, 0.77);
    expect(again).toEqual(first);
  });

  it('δεν εγγυάται ό,τι δεν μέτρησε: `null` όταν το όριο κελιών δεν φτάνει, και για απεικόνιση που απαντά NaN', () => {
    expect(createPlanarMapLattice(curved, DOMAIN, 1e-12, 8)).toBeNull();
    expect(createPlanarMapLattice(() => ({ x: Number.NaN, y: 0 }), DOMAIN, 1)).toBeNull();
  });

  it('κενό πεδίο ή μη θετική ανοχή ⇒ `null`, ποτέ διαίρεση με το μηδέν', () => {
    expect(createPlanarMapLattice(bilinear, { ...DOMAIN, maxU: DOMAIN.minU }, 1e-3)).toBeNull();
    expect(createPlanarMapLattice(bilinear, { ...DOMAIN, maxV: DOMAIN.minV - 1 }, 1e-3)).toBeNull();
    expect(createPlanarMapLattice(bilinear, DOMAIN, 0)).toBeNull();
    expect(createPlanarMapLattice(bilinear, DOMAIN, Number.NaN)).toBeNull();
  });
});
