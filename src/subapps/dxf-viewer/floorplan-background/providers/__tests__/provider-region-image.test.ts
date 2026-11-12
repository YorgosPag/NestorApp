/**
 * @jest-environment node
 *
 * ADR-929 Δ21 (δ) βήμα 1 — `cropPlanRegion`: κόβει ΜΟΝΟ την περιοχή από την ήδη αποκωδικοποιημένη πηγή.
 *   · px των `naturalBounds` → εγγενή px της πηγής (απόδοση PDF σε άλλη ανάλυση)·
 *   · κόψιμο στα όρια της εικόνας · ποτέ μεγέθυνση · μεγαλύτερη πλευρά ≤ maxEdgePx·
 *   · χωρίς πηγή ή περιοχή εκτός εικόνας ⇒ null.
 * Το `OffscreenCanvas` δεν υπάρχει σε node: ψεύτικο που καταγράφει το `drawImage` (τα ορίσματα ΕΙΝΑΙ η περικοπή).
 */

interface DrawCall { readonly args: readonly number[]; readonly width: number; readonly height: number }

const draws: DrawCall[] = [];

class FakeOffscreenCanvas {
  constructor(public width: number, public height: number) {}
  getContext(): { drawImage: (...a: unknown[]) => void } {
    return {
      drawImage: (...a: unknown[]) => { draws.push({ args: a.slice(1) as number[], width: this.width, height: this.height }); },
    };
  }
  async convertToBlob(): Promise<Blob> {
    return new Blob(['png'], { type: 'image/png' });
  }
}

Object.defineProperty(globalThis, 'OffscreenCanvas', { value: FakeOffscreenCanvas, configurable: true });

// eslint-disable-next-line import/first -- το ψεύτικο OffscreenCanvas πρέπει να υπάρχει πριν φορτωθεί το module
import { cropPlanRegion, type DecodedRasterSource } from '../provider-plan-raster';

/** Πηγή 2000 × 1600 εγγενή px για `naturalBounds` 1000 × 800 (απόδοση ×2, όπως το PDF). */
const SOURCE = new FakeOffscreenCanvas(2000, 1600) as unknown as DecodedRasterSource;
const BOUNDS = { width: 1000, height: 800 };

beforeEach(() => { draws.length = 0; });

describe('cropPlanRegion', () => {
  it('μετατρέπει σε εγγενή px και κόβει ΜΟΝΟ την περιοχή (ορθογώνιο πηγής στο drawImage)', async () => {
    const blob = await cropPlanRegion(SOURCE, BOUNDS, { minX: 100, minY: 50, maxX: 160, maxY: 70 }, 192);
    expect(blob).not.toBeNull();
    expect(draws).toEqual([{ args: [200, 100, 120, 40, 0, 0, 120, 40], width: 120, height: 40 }]);
  });

  it('μεγάλη περιοχή ⇒ σμίκρυνση ώστε η μεγαλύτερη πλευρά = maxEdgePx· μικρή ⇒ ΠΟΤΕ μεγέθυνση', async () => {
    await cropPlanRegion(SOURCE, BOUNDS, { minX: 0, minY: 0, maxX: 400, maxY: 100 }, 200);
    expect(draws[0]).toMatchObject({ width: 200, height: 50 });
    await cropPlanRegion(SOURCE, BOUNDS, { minX: 0, minY: 0, maxX: 5, maxY: 5 }, 200);
    expect(draws[1]).toMatchObject({ width: 10, height: 10 });
  });

  it('κόψιμο στα όρια της εικόνας· εντελώς έξω ή χωρίς πηγή ⇒ null', async () => {
    await cropPlanRegion(SOURCE, BOUNDS, { minX: -10, minY: 790, maxX: 20, maxY: 900 }, 192);
    expect(draws[0].args.slice(0, 4)).toEqual([0, 1580, 40, 20]);
    expect(await cropPlanRegion(SOURCE, BOUNDS, { minX: 1200, minY: 0, maxX: 1300, maxY: 10 }, 192)).toBeNull();
    expect(await cropPlanRegion(null, BOUNDS, { minX: 0, minY: 0, maxX: 10, maxY: 10 }, 192)).toBeNull();
  });
});
