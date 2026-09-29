/**
 * Άγκυρες του **codec των `.pbf` γραμματοσειρών** (ADR-891 §9.5).
 *
 * 🔑 **Δεύτερη φωνή**: ο κωδικοποιητής εδώ γράφεται ξανά, ανεξάρτητα από τον κώδικα που κρίνει — ένα test που έφτιαχνε
 * τα `.pbf` με τον ίδιο κώδικα θα έλεγχε ότι ο κώδικας συμφωνεί με τον εαυτό του.
 */

import { codepointRuns, glyphCodepoints, mergeGlyphRange } from '../glyph-pbf';

function varint(n: number): number[] {
  const out: number[] = [];
  let v = n;
  while (v > 127) {
    out.push((v & 127) | 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}

const bytesField = (field: number, payload: number[]): number[] => [...varint(field * 8 + 2), ...varint(payload.length), ...payload];
const intField = (field: number, value: number): number[] => [...varint(field * 8), ...varint(value)];
const text = (s: string): number[] => [...Buffer.from(s, 'utf8')];

/** Γλυφή με `advance` ως «αποτύπωμα» του face από το οποίο ήρθε. */
const glyph = (id: number, advance: number): number[] =>
  bytesField(3, [...intField(1, id), ...bytesField(2, [1, 2, 3]), ...intField(3, 1), ...intField(4, 1), ...intField(7, advance)]);

function rangePbf(range: string, glyphs: Array<[number, number]>): Buffer {
  const stack = [...bytesField(1, text('Noto Sans Regular')), ...bytesField(2, text(range)), ...glyphs.flatMap(([id, adv]) => glyph(id, adv))];
  return Buffer.from(bytesField(1, stack));
}

function advances(pbf: Uint8Array): Map<number, number> {
  // Ανάγνωση με το χέρι του πεδίου 7 κάθε γλυφής — ανεξάρτητα από το glyphCodepoints.
  const ids = glyphCodepoints(pbf);
  const out = new Map<number, number>();
  const raw = [...pbf];
  let cursor = 0;
  for (const id of ids) {
    const idTag = raw.indexOf(8, cursor); // πεδίο 1 varint μέσα στη γλυφή
    const advTag = raw.indexOf(56, idTag); // πεδίο 7 varint
    out.set(id, raw[advTag + 1]);
    cursor = advTag + 2;
  }
  return out;
}

describe('Α — ανάγνωση κωδικοσημείων', () => {
  it('με τη σειρά του αρχείου', () => {
    expect(glyphCodepoints(rangePbf('8704-8959', [[8722, 7], [8901, 5]]))).toEqual([8722, 8901]);
  });

  it('κενό εύρος ⇒ κανένα', () => {
    expect(glyphCodepoints(rangePbf('8704-8959', []))).toEqual([]);
  });

  it('κομμένο αρχείο ⇒ πετά, δεν μαντεύει', () => {
    const pbf = rangePbf('8704-8959', [[8722, 7]]);
    expect(() => glyphCodepoints(pbf.subarray(0, pbf.length - 3))).toThrow(/glyph pbf/);
  });
});

describe('Β — ένωση: μπαίνει ΜΟΝΟ ό,τι λείπει, η βάση κερδίζει', () => {
  const base = rangePbf('8704-8959', [[8722, 7], [8901, 5]]);
  const supplement = rangePbf('8704-8959', [[8722, 13], [8776, 13]]); // το «−» υπάρχει ήδη, το «≈» όχι

  it('το «≈» προστίθεται, το «−» της βάσης ΔΕΝ αντικαθίσταται', () => {
    const merged = mergeGlyphRange(base, supplement);
    expect(merged.added).toEqual([8776]);
    expect(glyphCodepoints(merged.pbf)).toEqual([8722, 8901, 8776]);
    expect(advances(merged.pbf).get(8722)).toBe(7);
    expect(advances(merged.pbf).get(8776)).toBe(13);
  });

  it('τα bytes της βάσης μένουν πρόθεμα του αποτελέσματος (καμία επανακωδικοποίηση γλυφών)', () => {
    const merged = mergeGlyphRange(base, supplement);
    const baseStack = base.subarray(2); // χωρίς ετικέτα + μήκος (<128 bytes)
    expect(Buffer.from(merged.pbf.subarray(2, 2 + baseStack.length)).equals(baseStack)).toBe(true);
  });

  it('ιδεμπότητα: δεύτερη ένωση δεν προσθέτει τίποτα · ίδια είσοδος ⇒ ίδια bytes', () => {
    const once = mergeGlyphRange(base, supplement);
    expect(mergeGlyphRange(once.pbf, supplement).added).toEqual([]);
    expect(mergeGlyphRange(base, supplement).pbf.equals(once.pbf)).toBe(true);
  });

  it('διαφορετικό εύρος ⇒ πετά', () => {
    expect(() => mergeGlyphRange(base, rangePbf('8960-9215', [[8960, 1]]))).toThrow(/εύρη/);
  });
});

describe('Γ — κωδικοσημεία σε διαστήματα', () => {
  it('ενώνει διαδοχικά, ταξινομεί, αφαιρεί διπλά', () => {
    expect(codepointRuns([48, 50, 49, 43, 8776, 49])).toEqual([[43, 43], [48, 50], [8776, 8776]]);
  });
});
