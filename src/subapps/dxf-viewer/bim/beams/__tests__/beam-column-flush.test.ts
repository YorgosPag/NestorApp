/**
 * ADR-363 §5.7 — `resolveBeamColumnFlushJustification` (side-face auto-flush) tests.
 *
 * Κλειδώνει: η πλευρική παρειά freehand δοκαριού επιλέγει `'left'`/`'right'` ώστε το
 * σώμα να εκτείνεται προς το εσωτερικό της κολόνας που πλαισιώνει άκρο του (full
 * bearing)· σύγκρουση/καμία κολόνα/εκφυλισμός → fallback (default του χρήστη).
 */

import { resolveBeamColumnFlushJustification } from '../beam-column-flush';
import type { Point2D } from '../../../rendering/types/Types';

/** Τετράγωνη κολόνα κέντρου (cx,cy), ημι-πλευράς `half`. */
function col(cx: number, cy: number, half: number): Point2D[] {
  return [
    { x: cx - half, y: cy - half },
    { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half },
    { x: cx - half, y: cy + half },
  ];
}

const FALLBACK = 'left' as const;

describe('resolveBeamColumnFlushJustification (ADR-363 §5.7)', () => {
  it('καμία κολόνα → fallback', () => {
    expect(resolveBeamColumnFlushJustification({ x: 0, y: 0 }, { x: 4000, y: 0 }, [], FALLBACK)).toBe('left');
  });

  it('degenerate (μηδενικού μήκους) άξονας → fallback', () => {
    expect(
      resolveBeamColumnFlushJustification({ x: 0, y: 0 }, { x: 0, y: 0 }, [col(0, 0, 200)], FALLBACK),
    ).toBe('left');
  });

  // Άξονας L→R (n = (0,+1)). Κολόνα στο start endpoint (0,0), κέντρο προς +y → σώμα προς +y → 'left'.
  it('L→R: κολόνα στο άκρο με κέντρο προς +y → "left" (σώμα προς +y, flush κάτω παρειά)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 4000, y: 0 };
    // Κολόνα γωνία στο (0,0): κέντρο (200,200) → +y side.
    const c = col(200, 200, 200);
    expect(resolveBeamColumnFlushJustification(start, end, [c], FALLBACK)).toBe('left');
  });

  it('L→R: κολόνα στο άκρο με κέντρο προς −y → "right" (σώμα προς −y)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 4000, y: 0 };
    const c = col(200, -200, 200); // κέντρο (200,−200) → −y side
    expect(resolveBeamColumnFlushJustification(start, end, [c], FALLBACK)).toBe('right');
  });

  it('L→R: κέντρο κολόνας ΠΑΝΩ στον άξονα (d≈0) → fallback (καμία προτίμηση)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 4000, y: 0 };
    const c = col(0, 0, 200); // κέντρο (0,0) πάνω στον άξονα y=0
    expect(resolveBeamColumnFlushJustification(start, end, [c], FALLBACK)).toBe('left');
  });

  it('κολόνες εκατέρωθεν (σύγκρουση: μία +y στο start, μία −y στο end) → fallback', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 4000, y: 0 };
    const cStart = col(0, 200, 250); // start εντός bbox x∈[−250,250] → κέντρο +y
    const cEnd = col(4000, -200, 250); // end εντός bbox → κέντρο −y
    expect(resolveBeamColumnFlushJustification(start, end, [cStart, cEnd], FALLBACK)).toBe('left');
  });

  it('κολόνα ΟΧΙ σε άκρο (στη μέση, μακριά από endpoints) → αγνοείται → fallback', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 4000, y: 0 };
    const c = col(2000, 300, 150); // bbox x∈[1850,2150] — κανένα endpoint μέσα
    expect(resolveBeamColumnFlushJustification(start, end, [c], FALLBACK)).toBe('left');
  });

  // Άξονας bottom→top (κατακόρυφος, canonical n = (−1,0)). Κολόνα στο top endpoint, κέντρο +x.
  it('κατακόρυφος άξονας: κολόνα στο άκρο με κέντρο προς +x → "right" (σώμα προς +x)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 0, y: 4000 };
    const c = col(200, 4000, 250); // end (0,4000) εντός bbox· κέντρο (200,4000) → +x
    // n=(−1,0)· d=(200−0)·(−1) = −200 <0 → 'right'· σώμα 'right' εκτείνεται προς +x (όπου η κολόνα)
    expect(resolveBeamColumnFlushJustification(start, end, [c], FALLBACK)).toBe('right');
  });

  it('κατακόρυφος άξονας: κολόνα με κέντρο προς −x → "left" (σώμα προς −x)', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 0, y: 4000 };
    const c = col(-200, 4000, 250);
    expect(resolveBeamColumnFlushJustification(start, end, [c], FALLBACK)).toBe('left');
  });

  it('σέβεται μη-default fallback ("right") όταν δεν υπάρχει κολόνα-αναφορά', () => {
    expect(
      resolveBeamColumnFlushJustification({ x: 0, y: 0 }, { x: 4000, y: 0 }, [col(2000, 300, 150)], 'right'),
    ).toBe('right');
  });
});
