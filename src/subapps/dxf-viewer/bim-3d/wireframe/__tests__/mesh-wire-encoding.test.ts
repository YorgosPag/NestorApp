/**
 * ADR-689 Φ3 — η κωδικοποίηση `aWireCode` και ο JS καθρέφτης του fragment shader.
 *
 * Ο καθρέφτης (`wireEdgeAlpha`) είναι ο ΜΟΝΟΣ τρόπος να ελεγχθεί η μαθηματική του wireframe χωρίς
 * GL context (ίδιο πρότυπο με το `projectedEmPixelHeight` του `glyph-atlas-text-lod`): ό,τι
 * επιβεβαιώνεται εδώ είναι ακριβώς ό,τι τρέχει ανά pixel στο `WIRE_FRAGMENT_COVERAGE`.
 */

import {
  computeWireCodes,
  decodeWireCode,
  edgeMaskToComponentMask,
  encodeWireCode,
  wireEdgeAlpha,
  WIRE_CORNER_RADIX,
} from '../mesh-wire-encoding';
import { EDGE_MASK_ALL } from '../mesh-wire-adjacency';
import { MESH_WIRE_FEATURE_ANGLE_DEG } from '../../../config/bim-visual-style';

/** Επίπεδο τετράγωνο σε 2 τρίγωνα — η διαγώνιός τους είναι η μόνη κρυφή ακμή. */
const FLAT_QUAD = new Float32Array([
  0, 0, 0, 1, 0, 0, 1, 1, 0,
  0, 0, 0, 1, 1, 0, 0, 1, 0,
]);

describe('encodeWireCode / decodeWireCode', () => {
  it('round-trip σε ΚΑΘΕ έγκυρο συνδυασμό γωνίας × μάσκας', () => {
    for (let corner = 0; corner < 3; corner++) {
      for (let mask = 0; mask <= EDGE_MASK_ALL; mask++) {
        const decoded = decodeWireCode(encodeWireCode(corner, mask));
        expect(decoded).toEqual({ corner, componentMask: mask });
      }
    }
  });

  it('όλοι οι κωδικοί χωρούν σε float32 χωρίς απώλεια (0..31)', () => {
    const max = encodeWireCode(2, EDGE_MASK_ALL);
    expect(max).toBe(2 + WIRE_CORNER_RADIX * EDGE_MASK_ALL);
    expect(new Float32Array([max])[0]).toBe(max);
  });
});

describe('edgeMaskToComponentMask', () => {
  it('η συνιστώσα i αντιστοιχεί στην ακμή (i+1)%3 — η αναδιάταξη που γλιτώνει ο shader', () => {
    expect(edgeMaskToComponentMask(0b001)).toBe(0b100); // ακμή 0 → συνιστώσα 2
    expect(edgeMaskToComponentMask(0b010)).toBe(0b001); // ακμή 1 → συνιστώσα 0
    expect(edgeMaskToComponentMask(0b100)).toBe(0b010); // ακμή 2 → συνιστώσα 1
  });

  it('«όλες» και «καμία» μένουν αναλλοίωτες', () => {
    expect(edgeMaskToComponentMask(EDGE_MASK_ALL)).toBe(EDGE_MASK_ALL);
    expect(edgeMaskToComponentMask(0)).toBe(0);
  });
});

describe('computeWireCodes', () => {
  it('mode «full» → κάθε κορυφή κουβαλά όλες τις ακμές, χωρίς ανάλυση γειτονίας', () => {
    const codes = computeWireCodes(FLAT_QUAD, 'full', MESH_WIRE_FEATURE_ANGLE_DEG);

    expect(codes).toHaveLength(6);
    for (const code of codes) expect(decodeWireCode(code).componentMask).toBe(EDGE_MASK_ALL);
  });

  it('mode «feature» → η διαγώνιος του επίπεδου τετραγώνου λείπει από τη μάσκα', () => {
    const codes = computeWireCodes(FLAT_QUAD, 'feature', MESH_WIRE_FEATURE_ANGLE_DEG);

    const masks = [decodeWireCode(codes[0]!).componentMask, decodeWireCode(codes[3]!).componentMask];
    for (const mask of masks) expect(mask).not.toBe(EDGE_MASK_ALL);
  });

  it('οι τρεις κορυφές κάθε τριγώνου διαφέρουν ΜΟΝΟ στη γωνία (0,1,2)', () => {
    const codes = computeWireCodes(FLAT_QUAD, 'feature', MESH_WIRE_FEATURE_ANGLE_DEG);

    const decoded = [0, 1, 2].map((i) => decodeWireCode(codes[i]!));
    expect(decoded.map((d) => d.corner)).toEqual([0, 1, 2]);
    expect(new Set(decoded.map((d) => d.componentMask)).size).toBe(1);
  });
});

describe('wireEdgeAlpha — ο καθρέφτης του fragment shader', () => {
  const DERIV = [0.01, 0.01, 0.01] as const;

  it('πάνω στην ακμή → πλήρης κάλυψη', () => {
    expect(wireEdgeAlpha([0, 0.5, 0.5], DERIV, EDGE_MASK_ALL, 1)).toBeCloseTo(1, 5);
  });

  it('στο κέντρο της όψης → μηδενική κάλυψη', () => {
    expect(wireEdgeAlpha([1 / 3, 1 / 3, 1 / 3], DERIV, EDGE_MASK_ALL, 1)).toBe(0);
  });

  it('μονότονη πτώση καθώς απομακρυνόμαστε από την ακμή', () => {
    const near = wireEdgeAlpha([0.005, 0.5, 0.495], DERIV, EDGE_MASK_ALL, 2);
    const mid = wireEdgeAlpha([0.015, 0.5, 0.485], DERIV, EDGE_MASK_ALL, 2);
    const far = wireEdgeAlpha([0.05, 0.5, 0.45], DERIV, EDGE_MASK_ALL, 2);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    expect(far).toBe(0);
  });

  it('κρυφή ακμή → μηδενική κάλυψη ΑΚΟΜΗ και πάνω της (αυτό κρύβει τη διαγώνιο)', () => {
    // Το pixel κάθεται ακριβώς στην ακμή που μηδενίζει τη συνιστώσα 0, αλλά το bit 0 είναι σβηστό.
    expect(wireEdgeAlpha([0, 0.5, 0.5], DERIV, 0b110, 1)).toBe(0);
  });

  it('καμία ορατή ακμή → τίποτα δεν ζωγραφίζεται', () => {
    expect(wireEdgeAlpha([0, 0, 1], DERIV, 0, 1)).toBe(0);
  });

  it('μεγαλύτερο πάχος → η ίδια θέση καλύπτεται περισσότερο', () => {
    const thin = wireEdgeAlpha([0.02, 0.5, 0.48], DERIV, EDGE_MASK_ALL, 1);
    const thick = wireEdgeAlpha([0.02, 0.5, 0.48], DERIV, EDGE_MASK_ALL, 4);
    expect(thick).toBeGreaterThan(thin);
  });

  it('εκφυλισμένο τρίγωνο (μηδενική παράγωγος) → καμία γραμμή, καμία διαίρεση με το μηδέν', () => {
    expect(wireEdgeAlpha([0, 0.5, 0.5], [0, 0, 0], EDGE_MASK_ALL, 1)).toBe(0);
  });
});
