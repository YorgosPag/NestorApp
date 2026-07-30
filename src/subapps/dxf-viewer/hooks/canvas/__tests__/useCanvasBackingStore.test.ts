/**
 * ADR-040 (2026-07-30) — useCanvasBackingStore: η ΠΡΩΤΗ μετάβαση 0 → πραγματικό μέγεθος
 * ΠΡΕΠΕΙ να συγχρονίζει το backing store.
 *
 * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΑΡΦΩΝΕΤΑΙ ΕΔΩ: DxfCanvas και LayerCanvas είχαν από ένα αντίγραφο ενός effect
 * που έλεγε `if (prev.width === 0 && prev.height === 0) return; // skip initial`. Στο mount το
 * viewport είναι 0×0, άρα το setupCanvas έκανε early-return· στη συνέχεια το «skip initial»
 * παρέκαμπτε τη μοναδική κλήση που θα διόρθωνε το buffer. Αποτέλεσμα: το <canvas> έμενε στο
 * default 300×150 με CSS 100%/100% → τεντωμένο καρέ ×5 («γιγάντιος χάρακας» μετά από σκληρή
 * ανανέωση), μέχρι να το σώσει κατά τύχη κάποιο άλλο effect.
 */

import { renderHook } from '@testing-library/react';
import { useCanvasBackingStore } from '../useCanvasBackingStore';
import type { Viewport } from '../../../rendering/types/Types';

jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1, // dpr=1 → backing == CSS ώστε τα νούμερα να διαβάζονται άμεσα
  toDevicePixels: (cssPixels: number) => cssPixels,
}));

const ZERO: Viewport = { width: 0, height: 0 };
const REAL: Viewport = { width: 1540, height: 752 };

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  // jsdom δεν έχει ούτε 2D context ούτε ResizeObserver.
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterAll(() => getContextSpy.mockRestore());

function mountWith(viewportProp: Viewport) {
  const canvas = document.createElement('canvas');
  const canvasRef = { current: canvas };
  const view = renderHook(
    ({ vp }: { vp: Viewport }) => useCanvasBackingStore({ canvasRef, viewportProp: vp, label: 'test' }),
    { initialProps: { vp: viewportProp } },
  );
  return { canvas, view };
}

describe('useCanvasBackingStore', () => {
  it('αφήνει το buffer στο default όσο ο container δεν έχει μετρηθεί (0×0)', () => {
    const { canvas } = mountWith(ZERO);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
  });

  it('συγχρονίζει στη ΠΡΩΤΗ μετάβαση 0 → πραγματικό μέγεθος (το παλιό «skip initial»)', () => {
    const { canvas, view } = mountWith(ZERO);
    expect(canvas.width).toBe(300);

    view.rerender({ vp: REAL });

    expect(canvas.width).toBe(1540);
    expect(canvas.height).toBe(752);
  });

  it('συγχρονίζει και σε κάθε επόμενη αλλαγή μεγέθους', () => {
    const { canvas, view } = mountWith(REAL);
    expect(canvas.width).toBe(1540);

    view.rerender({ vp: { width: 1000, height: 500 } });

    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(500);
  });

  it('εκθέτει σύγχρονο viewport ref για το RAF tick', () => {
    const { view } = mountWith(REAL);
    expect(view.result.current.resolvedViewportRef.current).toEqual(REAL);

    view.rerender({ vp: { width: 800, height: 400 } });
    expect(view.result.current.resolvedViewportRef.current).toEqual({ width: 800, height: 400 });
  });
});
