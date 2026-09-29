/**
 * ADR-884 Φ2στ-γ Γ3 · §12 Δ8.2 — η πρόταση νοητής γραμμής ΠΟΤΕ δεν προτείνει γραμμή που δεν χωρίζει.
 */

import { suggestSeparation } from '../separation-suggest';

/** Δακτύλιος: τετράγωνο 60×60 με τρύπα 30×30 στο κέντρο — δύο δρόμοι από αριστερά προς δεξιά. */
function annulus(): { region: Uint8Array; n: number } {
  const n = 60;
  const region = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const hole = c >= 15 && c < 45 && r >= 15 && r < 45;
      region[r * n + c] = hole ? 0 : 1;
    }
  }
  return { region, n };
}

describe('suggestSeparation', () => {
  it('δύο ανεξάρτητοι δρόμοι Α→Β ⇒ ΚΑΜΙΑ πρόταση (μία γραμμή δεν χωρίζει)', () => {
    const { region, n } = annulus();
    expect(suggestSeparation(region, n, n, 30 * n + 5, 30 * n + 54, 0)).toBeNull();
  });

  it('στενωπός ανάμεσα σε δύο αίθουσες ⇒ η χορδή του στενωπού', () => {
    const n = 60;
    const region = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const hall = r >= 10 && r < 50 && (c < 25 || c >= 35);
        const neck = c >= 25 && c < 35 && r >= 26 && r < 34;
        region[r * n + c] = hall || neck ? 1 : 0;
      }
    }
    const s = suggestSeparation(region, n, n, 30 * n + 10, 30 * n + 50, 0);
    expect(s).not.toBeNull();
    expect(s!.widthPx).toBeLessThan(10);
    const mid = (s!.segment.a.x + s!.segment.b.x) / 2;
    expect(mid).toBeGreaterThanOrEqual(25);
    expect(mid).toBeLessThanOrEqual(35);
  });
});
