/**
 * @fileoverview **ΒΑΘΜΟΝΟΜΗΣΗ «ΔΥΟ ΣΗΜΕΙΑ + ΓΝΩΣΤΗ ΑΠΟΣΤΑΣΗ»** (ADR-884 Φ2στ-β · §4.13) — καθαρά.
 *
 * - **Κ** — pixel ανά μέτρο με κάθε μονάδα· σημεία σχεδόν ίδια / απόσταση ≤ 0 ⇒ `null` (ποτέ θόρυβος ως κλίμακα).
 * - **Π** — «χωρά χωρίς κόψιμο»: κλικ στο κουτί → φυσικό pixel της εικόνας και πίσω· κλικ στο κενό γύρω ⇒ `null`.
 *   🔴 Αυτό ήταν το σφάλμα του `CalibrateScaleDialog` ως 2026-09-27: μετρούσε σε pixel του καμβά.
 */

import { boxToImagePoint, imageToBoxPoint, pixelsPerMetre } from '../scale-calibration';

describe('Κ — pixel ανά μέτρο', () => {
  it('100 pixel για 2 μέτρα = 50 px/m, σε m · cm · mm', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 60, y: 80 };
    expect(pixelsPerMetre(a, b, 2, 'm')).toBeCloseTo(50);
    expect(pixelsPerMetre(a, b, 200, 'cm')).toBeCloseTo(50);
    expect(pixelsPerMetre(a, b, 2000, 'mm')).toBeCloseTo(50);
  });

  it('σημεία σχεδόν ίδια ή απόσταση μη θετική ⇒ null', () => {
    expect(pixelsPerMetre({ x: 10, y: 10 }, { x: 11, y: 11 }, 1, 'm')).toBeNull();
    expect(pixelsPerMetre({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 'm')).toBeNull();
    expect(pixelsPerMetre({ x: 0, y: 0 }, { x: 100, y: 0 }, -3, 'm')).toBeNull();
    expect(pixelsPerMetre({ x: 0, y: 0 }, { x: 100, y: 0 }, Number.NaN, 'm')).toBeNull();
  });
});

describe('Π — κουτί ⟷ pixel εικόνας', () => {
  // Εικόνα 2000×1000 σε κουτί 640×420: κλίμακα 0,32, ύψος 320 ⇒ 50 κενό πάνω και κάτω.
  const box = { width: 640, height: 420 };
  const image = { width: 2000, height: 1000 };

  it('το κλικ επιστρέφει στο φυσικό pixel (όχι στο pixel του καμβά)', () => {
    expect(boxToImagePoint({ x: 320, y: 210 }, box, image)).toEqual({ x: 1000, y: 500 });
    expect(boxToImagePoint({ x: 0, y: 50 }, box, image)).toEqual({ x: 0, y: 0 });
  });

  it('κλικ στο κενό γύρω από την εικόνα ⇒ null', () => {
    expect(boxToImagePoint({ x: 320, y: 20 }, box, image)).toBeNull();
    expect(boxToImagePoint({ x: 320, y: 400 }, box, image)).toBeNull();
  });

  it('η απόσταση μετράται σε pixel εικόνας: ίδια κλίμακα όποιο κι αν είναι το κουτί', () => {
    const small = { width: 320, height: 210 };
    const inBig = [boxToImagePoint({ x: 0, y: 50 }, box, image), boxToImagePoint({ x: 640, y: 50 }, box, image)];
    const inSmall = [boxToImagePoint({ x: 0, y: 25 }, small, image), boxToImagePoint({ x: 320, y: 25 }, small, image)];
    const [a, b] = inBig;
    const [c, d] = inSmall;
    if (a === null || b === null || c === null || d === null) throw new Error('εκτός εικόνας');
    expect(pixelsPerMetre(a, b, 10, 'm')).toBeCloseTo(200);
    expect(pixelsPerMetre(c, d, 10, 'm')).toBeCloseTo(200);
  });

  it('πηγαινέλα: pixel εικόνας → κουτί → pixel εικόνας', () => {
    const point = { x: 1234, y: 321 };
    const back = boxToImagePoint(imageToBoxPoint(point, box, image), box, image);
    expect(back?.x).toBeCloseTo(point.x);
    expect(back?.y).toBeCloseTo(point.y);
  });
});
