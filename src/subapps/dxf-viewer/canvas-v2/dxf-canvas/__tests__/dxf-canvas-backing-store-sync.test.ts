/**
 * ADR-040 (2026-07-30) — SIZE-AT-PAINT-TIME: το backing store συγχρονίζεται ΜΕΣΑ στο frame.
 *
 * ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΑΡΦΩΝΕΤΑΙ ΕΔΩ (ο «γιγάντιος χάρακας» μετά από σκληρή ανανέωση):
 * Το <canvas> γεννιέται με backing store 300×150 (default του HTML) και CSS `width/height:100%`.
 * Το sizing έτρεχε ΜΟΝΟ σε React passive effects, ενώ το `resolvedViewportRef` ενημερώνεται
 * ΣΥΓΧΡΟΝΑ στο render body. Όταν το main thread είναι πνιγμένο (hard refresh: bundle parse +
 * hydration + DXF parse), ο RAF tick προλαβαίνει και ζωγραφίζει με viewport 1540×752 πάνω σε
 * buffer 300×150 → ο browser τεντώνει την εικόνα ×5,07: χάρακας 30px → 152px, γραμματοσειρά
 * 11px → ~56px. Ακριβώς η αναφορά του Giorgio (μέτρηση από στιγμιότυπο: 152/30 = 5,07 και
 * 1540/5,07 ≈ 304, 752/5,07 ≈ 148 → 300×150).
 *
 * Το τεστ ελέγχει τη ΣΕΙΡΑ, όχι τη μαθηματική του sizing (αυτό έχει δικό του τεστ στο
 * CanvasUtils.sizeCanvasToViewport.test.ts): κάθε painter του tick πρέπει να βλέπει backing
 * store ΣΥΜΦΩΝΟ με το viewport που του δίνεται — αλλιώς το καρέ βγαίνει τεντωμένο.
 */

import { renderHook } from '@testing-library/react';
import { useDxfCanvasRenderer } from '../dxf-canvas-renderer';
import type { Viewport } from '../../../rendering/types/Types';
import type { DxfRenderOptions } from '../dxf-types';

// ── Frame scheduler: κρατάμε το tick για να το καλέσουμε χειροκίνητα ──────────
let capturedTick: (() => void) | null = null;
jest.mock('../../../rendering', () => ({
  RENDER_PRIORITIES: { NORMAL: 2 },
  registerRenderCallback: (
    _id: string,
    _label: string,
    _priority: number,
    tick: () => void,
  ) => {
    capturedTick = tick;
    return () => { capturedTick = null; };
  },
}));

// ── Ό,τι αγγίζει το renderScene αλλά δεν αφορά το sizing ─────────────────────
jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1, // dpr=1 → backing == CSS, ώστε τα νούμερα να διαβάζονται άμεσα
  toDevicePixels: (cssPixels: number) => cssPixels,
}));
jest.mock('../../../systems/cursor/ImmediateTransformStore', () => ({
  getImmediateTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
}));
jest.mock('../../../services', () => ({
  serviceRegistry: { get: () => ({ updateScene: jest.fn() }) },
}));
jest.mock('../../../systems/axis-cut/axis-cut-line-renderer', () => ({
  renderAxisCutLines: jest.fn(),
}));
jest.mock('../../../systems/cursor/LassoStore', () => ({
  LassoStore: { getSnapshot: () => ({ isLasso: false, lassoPath: [] }) },
  computeLassoMode: () => 'window',
}));
jest.mock('../../../systems/cursor/config', () => ({
  getCursorSettings: () => ({ selection: {} }),
}));
jest.mock('../../../rendering/ui/core/UIRenderContext', () => ({
  createUIRenderContext: () => ({}),
}));
jest.mock('../useDxfCanvasCacheInvalidation', () => ({
  useDxfCanvasCacheInvalidation: jest.fn(),
}));
jest.mock('../../../debug/perf-line-profile', () => ({
  perfStart: () => 0,
  perfEnd: jest.fn(),
}));

// Το bitmap cache καταγράφει το πλάτος του buffer τη στιγμή του blit (entity layer).
const blitWidths: number[] = [];
let blitCanvas: HTMLCanvasElement | null = null;
jest.mock('../dxf-bitmap-cache', () => ({
  DxfBitmapCache: jest.fn().mockImplementation(() => ({
    isDirty: () => false,
    rebuild: jest.fn(),
    blit: () => { blitWidths.push(blitCanvas?.width ?? -1); },
    dispose: jest.fn(),
  })),
}));

// ── Harness ──────────────────────────────────────────────────────────────────

const VIEWPORT_REAL: Viewport = { width: 1540, height: 752 };
const RULER_SETTINGS = { enabled: true, visible: true } as unknown as Parameters<
  typeof useDxfCanvasRenderer
>[0]['rulerSettings'];

/** Πλάτη buffer όπως τα είδε ο RulerRenderer τη στιγμή που κλήθηκε. */
const rulerWidths: number[] = [];

function makeRefs(canvas: HTMLCanvasElement, viewport: Viewport) {
  const viewportRef = { current: viewport };
  return {
    refs: {
      rendererRef: { current: { render: jest.fn(), renderSingleEntity: jest.fn() } },
      canvasRef: { current: canvas },
      gridRendererRef: { current: null },
      rulerRendererRef: {
        current: { render: () => { rulerWidths.push(canvas.width); } },
      },
      guideRendererRef: { current: null },
      selectionRendererRef: { current: null },
      resolvedViewportRef: viewportRef,
      selectionStateRef: { current: { isSelecting: false, selectionStart: null, selectionCurrent: null } },
      activeToolRef: { current: undefined },
      guidesRef: { current: undefined },
      guidesVisibleRef: { current: false },
      showGuideDimensionsRef: { current: false },
      highlightedGuideIdRef: { current: null },
      selectedGuideIdsRef: { current: undefined },
      ghostGuideRef: { current: null },
      ghostDiagonalGuideRef: { current: null },
      constructionPointsRef: { current: undefined },
      highlightedPointIdRef: { current: null },
      ghostSegmentLineRef: { current: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ref bundle
    } as any,
    viewportRef,
  };
}

function renderTick(canvas: HTMLCanvasElement, viewport: Viewport) {
  const { refs, viewportRef } = makeRefs(canvas, viewport);
  blitCanvas = canvas;
  const view = renderHook(() =>
    useDxfCanvasRenderer({
      scene: null,
      renderOptions: { selectedEntityIds: [] } as unknown as DxfRenderOptions,
      rulerSettings: RULER_SETTINGS,
      viewport,
      refs,
      guidesVisible: false,
      showGuideDimensions: false,
    }),
  );
  return { view, viewportRef };
}

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
    } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
});

afterAll(() => getContextSpy.mockRestore());

beforeEach(() => {
  rulerWidths.length = 0;
  blitWidths.length = 0;
  capturedTick = null;
});

describe('DxfCanvas render tick — backing store συγχρονισμένο με το viewport', () => {
  it('ένα φρέσκο <canvas> ξεκινά όντως στο default 300×150 (η αιτία του τεντώματος)', () => {
    const canvas = document.createElement('canvas');
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
  });

  it('συγχρονίζει το buffer ΠΡΙΝ ζωγραφίσει ο χάρακας, χωρίς να έχει τρέξει κανένα setupCanvas', () => {
    const canvas = document.createElement('canvas');
    renderTick(canvas, VIEWPORT_REAL);

    expect(capturedTick).not.toBeNull();
    capturedTick!();

    // Ο χάρακας ΔΕΝ πρέπει ποτέ να δει buffer 300 ενώ του δίνεται viewport 1540.
    expect(rulerWidths).toEqual([1540]);
    expect(canvas.width).toBe(1540);
    expect(canvas.height).toBe(752);
  });

  it('το ίδιο ισχύει για το entity layer (blit) — ίδιο frame, ίδιο buffer', () => {
    const canvas = document.createElement('canvas');
    renderTick(canvas, VIEWPORT_REAL);
    capturedTick!();

    expect(blitWidths).toEqual([1540]);
  });

  it('παρακολουθεί μεταγενέστερη αλλαγή viewport χωρίς να περιμένει effect', () => {
    const canvas = document.createElement('canvas');
    const { viewportRef } = renderTick(canvas, VIEWPORT_REAL);
    capturedTick!();

    // Ο container μίκρυνε (π.χ. άνοιξε πλαϊνό panel) — ο tick το βλέπει από το ref.
    viewportRef.current = { width: 1000, height: 500 };
    capturedTick!();

    expect(rulerWidths).toEqual([1540, 1000]);
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(500);
  });

  it('είναι idempotent: σταθερό viewport → καμία επανεγγραφή του buffer (καμία σβήσιμο καρέ)', () => {
    const canvas = document.createElement('canvas');
    renderTick(canvas, VIEWPORT_REAL);
    capturedTick!();

    // Μετά τον πρώτο συγχρονισμό, κάθε γραφή στο canvas.width θα καθάριζε τον καμβά.
    const writes: number[] = [];
    const proto = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get: () => proto?.get?.call(canvas) as number,
      set: (v: number) => { writes.push(v); proto?.set?.call(canvas, v); },
    });

    capturedTick!();
    capturedTick!();

    expect(writes).toEqual([]);
  });
});
