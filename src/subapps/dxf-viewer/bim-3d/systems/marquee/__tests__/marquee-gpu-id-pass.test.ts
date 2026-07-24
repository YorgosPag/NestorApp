/**
 * ADR-692 Φ2 — τα καθαρά κομμάτια του GPU id-pass: αποκωδικοποίηση του id buffer,
 * κόψιμο του ορθογωνίου στα όρια του canvas, μέγεθος στόχου (device px + cap).
 * Το ίδιο το render pass απαιτεί WebGL — καλύπτεται από browser έλεγχο (§9 ADR-692).
 */

import {
  decodeVisibleIds,
  clipRectToCanvas,
  idPassTargetSize,
  MAX_ID_PASS_AXIS_PX,
} from '../marquee-gpu-id-pass';

function rectOf(x: number, y: number, w: number, h: number): DOMRect {
  return {
    left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Buffer βοηθός: κάθε τιμή = ένας 24-bit δείκτης, ένα pixel. */
function bufferOf(indices: number[]): Uint8Array {
  const pixels = new Uint8Array(indices.length * 4);
  indices.forEach((index, i) => {
    pixels[i * 4] = (index >> 16) & 0xff;
    pixels[i * 4 + 1] = (index >> 8) & 0xff;
    pixels[i * 4 + 2] = index & 0xff;
    pixels[i * 4 + 3] = 255;
  });
  return pixels;
}

describe('decodeVisibleIds', () => {
  const idByIndex = ['', 'wall-1', 'wall-2', 'col-9'];

  it('μαζεύει κάθε δείκτη που εμφανίζεται, χωρίς διπλά', () => {
    const visible = decodeVisibleIds(bufferOf([1, 1, 3, 0]), 4, idByIndex);
    expect([...visible].sort()).toEqual(['col-9', 'wall-1']);
  });

  it('ο δείκτης 0 (φόντο) δεν παράγει ποτέ id', () => {
    expect(decodeVisibleIds(bufferOf([0, 0]), 2, idByIndex).size).toBe(0);
  });

  it('δείκτης εκτός πίνακα αγνοείται (δεν σκάει)', () => {
    expect(decodeVisibleIds(bufferOf([99]), 1, idByIndex).size).toBe(0);
  });

  it('αποκωδικοποιεί σωστά δείκτη πάνω από 255 (πολυ-byte)', () => {
    const many = ['', ...Array.from({ length: 300 }, (_, i) => `e${i + 1}`)];
    const visible = decodeVisibleIds(bufferOf([300]), 1, many);
    expect([...visible]).toEqual(['e300']);
  });
});

describe('clipRectToCanvas', () => {
  const canvas = rectOf(100, 50, 800, 600);

  it('μετατρέπει client → canvas συντεταγμένες', () => {
    const rect = { min: { x: 150, y: 100 }, max: { x: 250, y: 200 } };
    expect(clipRectToCanvas(rect, canvas)).toEqual({ x: 50, y: 50, width: 100, height: 100 });
  });

  it('κόβει ό,τι βγαίνει εκτός canvas', () => {
    const rect = { min: { x: -500, y: -500 }, max: { x: 5000, y: 5000 } };
    expect(clipRectToCanvas(rect, canvas)).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('δέχεται ανάποδο drag (R→L / κάτω→πάνω)', () => {
    const rect = { min: { x: 250, y: 200 }, max: { x: 150, y: 100 } };
    expect(clipRectToCanvas(rect, canvas)).toEqual({ x: 50, y: 50, width: 100, height: 100 });
  });

  it('null όταν το ορθογώνιο είναι εκτός canvas ή εκφυλισμένο', () => {
    expect(clipRectToCanvas({ min: { x: 0, y: 0 }, max: { x: 50, y: 40 } }, canvas)).toBeNull();
    expect(clipRectToCanvas({ min: { x: 200, y: 100 }, max: { x: 200, y: 300 } }, canvas)).toBeNull();
  });
});

describe('idPassTargetSize', () => {
  it('πολλαπλασιάζει με το device pixel ratio', () => {
    expect(idPassTargetSize(100, 50, 2)).toEqual({ w: 200, h: 100 });
  });

  it('κόβει στο ανώτατο όριο ανά άξονα', () => {
    const size = idPassTargetSize(4000, 3000, 2);
    expect(size).toEqual({ w: MAX_ID_PASS_AXIS_PX, h: MAX_ID_PASS_AXIS_PX });
  });

  it('ποτέ κάτω από 1 pixel', () => {
    expect(idPassTargetSize(0.2, 0.2, 1)).toEqual({ w: 1, h: 1 });
  });
});
