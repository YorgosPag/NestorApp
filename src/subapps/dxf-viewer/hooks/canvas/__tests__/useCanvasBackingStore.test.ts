/**
 * ADR-040 (2026-07-30) — useCanvasBackingStore: το backing store ακολουθεί ΚΑΘΕ πηγή μεγέθους.
 *
 * ΠΛΑΙΣΙΟ (ο «γιγάντιος χάρακας» μετά από σκληρή ανανέωση): ένα <canvas> γεννιέται με backing
 * store 300×150 και CSS `width/height:100%`. Όποτε ζωγραφιστεί καρέ πριν συγχρονιστεί ο buffer,
 * ο browser το τεντώνει (×5,07 στη μέτρηση του Giorgio). Το ΟΡΙΣΤΙΚΟ δίχτυ είναι το
 * size-at-paint-time μέσα στον render tick (βλ. dxf-canvas-backing-store-sync.test.ts)· αυτό
 * το module είναι η ΠΡΟΛΗΨΗ — φροντίζει ο buffer να είναι ήδη σωστός πριν καν ζητηθεί καρέ.
 *
 * ΤΟ ΣΥΓΚΕΚΡΙΜΕΝΟ ΚΕΝΟ ΠΟΥ ΚΑΡΦΩΝΕΤΑΙ ΕΔΩ (standalone mode): χωρίς `viewportProp` το μέγεθος
 * έρχεται από τον ΤΟΠΙΚΟ ResizeObserver του `useCanvasResize`. Ο callback του ενημέρωνε μόνο
 * το ref· το sizing ζούσε σε effect με deps `viewportProp` — που εκεί δεν αλλάζει ΠΟΤΕ. Άρα ο
 * buffer έμενε στο 300×150 επ' αόριστον ενώ το ref ανέφερε το πραγματικό μέγεθος.
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

/** Τελευταίος ResizeObserver callback που στήθηκε — για χειροκίνητη πυροδότηση. */
let lastObserverCallback: ResizeObserverCallback | null = null;

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  // jsdom δεν έχει ούτε 2D context ούτε ResizeObserver.
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);

  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) { lastObserverCallback = cb; }
    observe() {}
    unobserve() {}
    disconnect() { lastObserverCallback = null; }
  } as unknown as typeof ResizeObserver;
});

afterAll(() => getContextSpy.mockRestore());

beforeEach(() => { lastObserverCallback = null; });

function mountWith(viewportProp: Viewport | undefined) {
  const canvas = document.createElement('canvas');
  const canvasRef = { current: canvas };
  const view = renderHook(
    ({ vp }: { vp: Viewport | undefined }) =>
      useCanvasBackingStore({ canvasRef, viewportProp: vp, label: 'test' }),
    { initialProps: { vp: viewportProp } },
  );
  return { canvas, view };
}

/** Πυροδοτεί τον τοπικό ResizeObserver όπως ο browser όταν μετρηθεί ο container. */
function emitResize(target: HTMLCanvasElement, width: number, height: number) {
  lastObserverCallback?.(
    [{ target, contentRect: { width, height } } as unknown as ResizeObserverEntry],
    {} as ResizeObserver,
  );
}

describe('useCanvasBackingStore — container viewport (SSoT από τον parent)', () => {
  it('αφήνει το buffer στο default όσο ο container δεν έχει μετρηθεί (0×0)', () => {
    const { canvas } = mountWith(ZERO);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
  });

  it('συγχρονίζει στη μετάβαση 0 → πραγματικό μέγεθος', () => {
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

describe('useCanvasBackingStore — standalone (τοπικός ResizeObserver, χωρίς viewportProp)', () => {
  it('συγχρονίζει τον buffer από τον ResizeObserver, χωρίς να περιμένει αλλαγή prop', () => {
    const { canvas } = mountWith(undefined);
    expect(canvas.width).toBe(300);
    expect(lastObserverCallback).not.toBeNull();

    emitResize(canvas, 1540, 752);

    // Χωρίς το onSetupCanvas στον observer, εδώ έμενε 300 επ' αόριστον → τεντωμένο καρέ.
    expect(canvas.width).toBe(1540);
    expect(canvas.height).toBe(752);
  });

  it('ακολουθεί και τις επόμενες μετρήσεις του observer', () => {
    const { canvas } = mountWith(undefined);
    emitResize(canvas, 1540, 752);
    emitResize(canvas, 900, 450);

    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(450);
  });
});
