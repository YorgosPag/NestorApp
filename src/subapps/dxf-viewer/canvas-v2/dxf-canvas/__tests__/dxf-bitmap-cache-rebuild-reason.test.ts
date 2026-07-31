/**
 * ADR-743 Φ0 — ΓΙΑΤΙ ξαναχτίζεται το raster, όχι μόνο πόσο κοστίζει.
 *
 * ## Το ερώτημα που δεν είχε όργανο
 *
 * Μετρήθηκε σε production (ADR-735 §7.2): `frame:dxf-canvas` p90 **120,2ms** στο zoom με **n=155**
 * ζωγραφιές σε 20΄΄. Ένας χρόνος όμως δεν λέει **ποιος τον ζήτησε**: «ένα ακριβό re-raster» και
 * «πολλά μικρά που συσσωρεύονται» δίνουν το ίδιο p90, και οδηγούν σε **αντίθετες** θεραπείες.
 *
 * ## Γιατί ο διαχωρισμός `@gesture` / `@rest` ΕΙΝΑΙ το πείραμα
 *
 * `RASTER_IDLE` = 120ms αλλά `WHEEL_IDLE` = 220ms, και το `rerasterDue` ελέγχεται **ΠΡΙΝ** τον
 * gesture guard. Άρα ένα ανθρώπινο κενό 120–220ms μέσα σε ριπή ροδέλας **μπορεί** να πυροδοτεί
 * πλήρες re-raster ενώ η προστασία ADR-726 Φ3.1 νομίζει ότι η χειρονομία τρέχει. Χωρίς τον
 * διαχωρισμό, το σενάριο «η Φ3.1 έχει τρύπα» και το σενάριο «όλα ήρεμα» παράγουν **τον ίδιο
 * αριθμό** — και η υπόθεση μένει αναπόδεικτη για πάντα.
 *
 * ## Τι φυλάει αυτό το αρχείο
 *
 * Χρησιμοποιεί τον **ΠΡΑΓΜΑΤΙΚΟ** aggregator (`mouse-handler-perf`), όχι mock: ελέγχεται η
 * ΚΑΛΩΔΙΩΣΗ από άκρη σε άκρη — flag → `recordSample` → γραμμή στον πίνακα. Ένα mock θα
 * επιβεβαίωνε ότι «κλήθηκε μια συνάρτηση», όχι ότι **θα δούμε νούμερο** στη μέτρηση.
 *
 * ⚠️ Καρφώνει επίσης ότι με **κλειστό flag** δεν καταγράφεται τίποτα: το όργανο πρέπει να είναι
 * αόρατο σε production όσο δεν το ζητά κανείς.
 */

import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import type { DxfScene } from '../dxf-types';
import { DxfBitmapCache, type BitmapCacheRenderInputs } from '../dxf-bitmap-cache';
import { resetPerf, snapshotPerfRows } from '../../../systems/cursor/mouse-handler-perf';
import { rasterRebuildReasonCounter, type RasterRebuildReason } from '../dxf-canvas-perf-stages';

jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({ render: jest.fn() })),
}));
jest.mock('../../../systems/viewport/ViewportStore', () => ({ getActiveScaleName: () => '1:50' }));

let mockGestureActive = false;
jest.mock('../../../systems/navigation/NavigationGestureStore', () => ({
  isNavigationGesture: () => mockGestureActive,
}));
jest.mock('../../../bim/services/opening-tag-style-service', () => ({
  getCurrentOpeningTagStyle: () => ({ enabled: false }),
}));
jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1,
  toDevicePixels: (cssPixels: number) => cssPixels,
}));
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { getState: () => ({ drawingScale: 50, viewRange: {}, objectStyles: {} }) },
}));

const SCENE: DxfScene = { entities: [] } as unknown as DxfScene;
const VIEWPORT: Viewport = { width: 800, height: 600 };
const BASE: BitmapCacheRenderInputs = { showGrid: false, showLayerNames: false, wireframeMode: false };
const ANCHOR: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
/** `computeOverscanPx({800,600})` = 0,2 × 600 = 120 CSS px ανά πλευρά. */
const OVERSCAN = 120;

interface PerfWindow { __dxfPerf?: { refresh(): boolean } }

function setPerfFlag(on: boolean): void {
  if (on) window.localStorage.setItem('dxf-perf-trace', '1');
  else window.localStorage.removeItem('dxf-perf-trace');
  (window as unknown as PerfWindow).__dxfPerf?.refresh();
}

function targetCtx(): CanvasRenderingContext2D {
  return {
    save: jest.fn(), restore: jest.fn(), setTransform: jest.fn(),
    clearRect: jest.fn(), drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D;
}

/** Τα ονόματα των μετρητών που κατέγραψε το τελευταίο παράθυρο μέτρησης. */
function recordedCounters(): string[] {
  return snapshotPerfRows().filter((r) => r.stage.startsWith('n:raster-why-')).map((r) => r.stage);
}

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
});
afterAll(() => {
  getContextSpy.mockRestore();
  setPerfFlag(false);
});

beforeEach(() => {
  mockGestureActive = false;
  setPerfFlag(true);
  resetPerf();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** Cache με έτοιμο raster στην άγκυρα — η αφετηρία κάθε σεναρίου εκτός του `no-raster`. */
function seededCache(): DxfBitmapCache {
  const cache = new DxfBitmapCache();
  cache.rebuild(SCENE, ANCHOR, VIEWPORT, BASE);
  resetPerf(); // το ίδιο το seeding δεν είναι μέρος του σεναρίου
  return cache;
}

describe('DxfBitmapCache — η αιτία του rebuild καταγράφεται, χωρισμένη σε χειρονομία/ηρεμία', () => {
  it('no-raster: πριν από το πρώτο χτίσιμο', () => {
    const cache = new DxfBitmapCache();
    expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(true);
    expect(recordedCounters()).toEqual([rasterRebuildReasonCounter('no-raster', false)]);
  });

  it('structural: αλλαγή viewport ⇒ δομική ακύρωση, ΠΟΤΕ δεν αναστέλλεται από χειρονομία', () => {
    const cache = seededCache();
    mockGestureActive = true; // ⚠️ ακόμη και μέσα σε χειρονομία
    expect(cache.isDirty(SCENE, ANCHOR, { width: 1024, height: 768 }, BASE)).toBe(true);
    expect(recordedCounters()).toEqual([rasterRebuildReasonCounter('structural', true)]);
  });

  it('idle-due: ο idle timer χτυπά — και ο μετρητής δείχνει ότι έγινε ΜΕΣΑ σε χειρονομία', () => {
    const cache = seededCache();
    // Μια μετατοπισμένη προβολή οπλίζει τον idle timer μέσα από το blit (ADR-726 Φ3).
    const drifted: ViewTransform = { ...ANCHOR, offsetX: 40 };
    cache.blit(targetCtx(), VIEWPORT, drifted);
    resetPerf();
    jest.advanceTimersByTime(200);
    mockGestureActive = true; // η ριπή ροδέλας συνεχίζεται (WHEEL_IDLE 220 > RASTER_IDLE 120)
    expect(cache.isDirty(SCENE, drifted, VIEWPORT, BASE)).toBe(true);
    expect(recordedCounters()).toEqual([rasterRebuildReasonCounter('idle-due', true)]);
  });

  it('unusable: μη-πεπερασμένη μεγέθυνση ⇒ rebuild ανεξαρτήτως χειρονομίας', () => {
    const cache = seededCache();
    mockGestureActive = true;
    expect(cache.isDirty(SCENE, { ...ANCHOR, scale: 0 }, VIEWPORT, BASE)).toBe(true);
    expect(recordedCounters()).toEqual([rasterRebuildReasonCounter('unusable', true)]);
  });

  it('quality: μετατόπιση πέρα από το overscan ΣΕ ΗΡΕΜΙΑ ⇒ τρύπα ⇒ rebuild', () => {
    const cache = seededCache();
    expect(cache.isDirty(SCENE, { ...ANCHOR, offsetX: OVERSCAN * 4 }, VIEWPORT, BASE)).toBe(true);
    expect(recordedCounters()).toEqual([rasterRebuildReasonCounter('quality', false)]);
  });

  it('🔴 ΤΟ ΙΔΙΟ σενάριο ποιότητας ΜΕΣΑ σε χειρονομία δεν ξαναχτίζει καθόλου (ADR-726 Φ3.1)', () => {
    const cache = seededCache();
    mockGestureActive = true;
    expect(cache.isDirty(SCENE, { ...ANCHOR, offsetX: OVERSCAN * 4 }, VIEWPORT, BASE)).toBe(false);
    expect(recordedCounters()).toEqual([]);
  });

  it('cache HIT ⇒ κανένας μετρητής (ο πίνακας δεν γεμίζει με μηδενικά)', () => {
    const cache = seededCache();
    expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(false);
    expect(recordedCounters()).toEqual([]);
  });

  it('οι πέντε αιτίες δίνουν πέντε ΔΙΑΦΟΡΕΤΙΚΑ ονόματα ανά κατάσταση χειρονομίας', () => {
    const reasons: RasterRebuildReason[] = ['no-raster', 'idle-due', 'structural', 'unusable', 'quality'];
    const names = reasons.flatMap((r) => [
      rasterRebuildReasonCounter(r, true),
      rasterRebuildReasonCounter(r, false),
    ]);
    expect(new Set(names).size).toBe(10);
  });

  it('με ΚΛΕΙΣΤΟ flag το όργανο είναι εντελώς σιωπηλό', () => {
    setPerfFlag(false);
    const cache = new DxfBitmapCache();
    expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(true); // ίδια συμπεριφορά
    setPerfFlag(true);
    expect(recordedCounters()).toEqual([]);                          // καμία καταγραφή
  });
});
