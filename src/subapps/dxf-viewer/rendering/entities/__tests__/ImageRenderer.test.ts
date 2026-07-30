// Firebase auth chain reaches ImageRenderer via BaseEntityRenderer → PhaseManager →
// GripProvider → user-settings → firestore. Stub it before any imports execute
// (mirror ScaleBarRenderer.test.ts) so the test env doesn't need fetch / real firebase init.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-651 Φάση Ε — ImageRenderer smoke tests.
 *
 * Verifies: type guard, contain-fit placeholder-vs-image branching (via a mocked
 * `HatchImageCache.resolve()` — deterministic, no jsdom `Image.decode()` flakiness),
 * rotation-aware corner grips, and rotation-aware fill hit-test.
 */

// Deterministic image-cache stub — the SAME reused SSoT (ADR-643 Φ1), mocked here so the
// test controls exactly when `resolve()` returns an image vs `null` (loading/error).
let mockResolvedImage: { width: number; height: number } | null = null;
// ADR-736 Φ2 — κάθε `resolve()` καταγράφεται: ο έλεγχος «ανεπίλυτη αναφορά ⇒ το cache ΔΕΝ
// ρωτιέται καθόλου» δεν μπορεί να γραφτεί από την επιστροφή (και τα δύο μονοπάτια δίνουν `null`).
let mockResolveArgs: unknown[] = [];
jest.mock('../shared/hatch-image-cache', () => ({
  HatchImageCache: jest.fn().mockImplementation(() => ({
    resolve: (spec: unknown) => {
      mockResolveArgs.push(spec);
      return mockResolvedImage;
    },
  })),
}));

import type { Point2D } from '../../types/Types';
import type { ImageEntity } from '../../../types/image';
import { ImageRenderer } from '../ImageRenderer';

// ──────────────────────────────────────────────────────────────────────────────
// Mock CanvasRenderingContext2D (mirror ScaleBarRenderer.test.ts)
// ──────────────────────────────────────────────────────────────────────────────

interface MockCtxCall {
  fn: string;
  args: readonly unknown[];
}

interface MockCtx {
  calls: MockCtxCall[];
  ctx: CanvasRenderingContext2D;
}

function createMockCtx(width = 800, height = 600): MockCtx {
  const calls: MockCtxCall[] = [];
  const record = (fn: string) =>
    (...args: unknown[]): unknown => {
      calls.push({ fn, args });
      return undefined;
    };
  const canvas = {
    width, height,
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, right: width, bottom: height }),
  };
  const ctxStub = {
    canvas,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    stroke: record('stroke'),
    fill: record('fill'),
    drawImage: record('drawImage'),
    transform: record('transform'),
    setLineDash: record('setLineDash'),
    // ADR-736 Φ2 — η ετικέτα του placeholder μετριέται πριν σχεδιαστεί. Πλάτος ≈ 6px/χαρακτήρα:
    // αρκετά ρεαλιστικό ώστε το κόψιμο με αποσιωπητικά να είναι ελέγξιμο ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ (το
    // jsdom δεν έχει πραγματικές μετρικές γραμματοσειράς).
    measureText: (text: string) => {
      calls.push({ fn: 'measureText', args: [text] });
      return { width: text.length * 6 };
    },
    fillText: record('fillText'),
    set font(v: string) { calls.push({ fn: 'set:font', args: [v] }); },
    set textAlign(v: string) { calls.push({ fn: 'set:textAlign', args: [v] }); },
    set textBaseline(v: string) { calls.push({ fn: 'set:textBaseline', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    get strokeStyle() { return '#000000'; },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
    set globalAlpha(v: number) { calls.push({ fn: 'set:globalAlpha', args: [v] }); },
    get globalAlpha() { return 1; },
    set globalCompositeOperation(v: string) { calls.push({ fn: 'set:globalCompositeOperation', args: [v] }); },
    set lineCap(v: string) { calls.push({ fn: 'set:lineCap', args: [v] }); },
    set lineJoin(v: string) { calls.push({ fn: 'set:lineJoin', args: [v] }); },
    set shadowBlur(v: number) { calls.push({ fn: 'set:shadowBlur', args: [v] }); },
    set shadowColor(v: string) { calls.push({ fn: 'set:shadowColor', args: [v] }); },
  };
  return { calls, ctx: ctxStub as unknown as CanvasRenderingContext2D };
}

function countCalls(mock: MockCtx, fn: string): number {
  return mock.calls.filter((c) => c.fn === fn).length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

function makeRenderer(): { renderer: ImageRenderer; mock: MockCtx } {
  const mock = createMockCtx();
  const renderer = new ImageRenderer(mock.ctx);
  renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  return { renderer, mock };
}

function makeImage(overrides: Partial<ImageEntity> = {}): ImageEntity {
  return {
    id: 'img_render_test',
    type: 'image',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    url: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

beforeEach(() => {
  mockResolvedImage = null;
  mockResolveArgs = [];
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ImageRenderer — render smoke', () => {
  it('draws a dashed placeholder while the image has not resolved yet', () => {
    const { renderer, mock } = makeRenderer();
    expect(() => renderer.render(makeImage())).not.toThrow();
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
    expect(countCalls(mock, 'drawImage')).toBe(0);
  });

  it('draws the resolved image FILL (covers the whole box) once resolved', () => {
    mockResolvedImage = { width: 200, height: 100 }; // 2:1 aspect, same as the 100x50 box
    const { renderer, mock } = makeRenderer();
    expect(() => renderer.render(makeImage())).not.toThrow();
    expect(countCalls(mock, 'drawImage')).toBe(1);
    expect(countCalls(mock, 'transform')).toBeGreaterThanOrEqual(1);
    const call = mock.calls.find((c) => c.fn === 'drawImage');
    // Fill: the sprite fills the entire width×height frame, top-left at local (0,0), zero letterbox.
    expect(call?.args).toEqual([mockResolvedImage, 0, 0, 100, 50]);
  });

  it('STRETCHES a mismatched-aspect image to fill the box (fill, no letterbox)', () => {
    mockResolvedImage = { width: 100, height: 100 }; // square image in a 100×50 box
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage());
    const call = mock.calls.find((c) => c.fn === 'drawImage');
    // Fill (big-player parity): the square is stretched to cover the full 100×50 frame — the
    // visible sprite ALWAYS coincides with the frame/grips (a non-uniform edge handle stretches it).
    expect(call?.args).toEqual([mockResolvedImage, 0, 0, 100, 50]);
  });

  it('ignores non-image entities (type guard short-circuits)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render({ id: 'not_an_image', type: 'line', layerId: 'lyr_test' } as unknown as ImageEntity);
    expect(countCalls(mock, 'stroke')).toBe(0);
    expect(countCalls(mock, 'drawImage')).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ADR-736 Φ2 — ανεπίλυτη εξωτερική αναφορά (το DXF κρατά διαδρομή, όχι bytes)
// ──────────────────────────────────────────────────────────────────────────────

describe('ImageRenderer — ανεπίλυτη εξωτερική αναφορά (ADR-736 Φ2)', () => {
  /** Οι τιμές που πέρασαν στο `ctx.fillText` (το κείμενο είναι το 1ο όρισμα). */
  const drawnLabels = (mock: MockCtx): string[] =>
    mock.calls.filter((c) => c.fn === 'fillText').map((c) => String(c.args[0]));

  it('ΔΕΝ ρωτά καθόλου το image cache όταν λείπει το url', () => {
    // Κενό `url` σε `img.src` επιλύεται από τον browser στο URL της ΙΔΙΑΣ ΤΗΣ ΣΕΛΙΔΑΣ ⇒ ένα
    // άχρηστο αίτημα δικτύου ανά εικόνα, που αποτυγχάνει στο decode και κλειδώνει slot `error`.
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage({ url: '', sourceName: 'dianomi_1.JPG' }));
    expect(mockResolveArgs).toEqual([]);
    expect(countCalls(mock, 'drawImage')).toBe(0);
  });

  it('ζωγραφίζει πλαίσιο ΚΑΙ το όνομα του αρχείου που λείπει', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage({ url: '', sourceName: 'dianomi_1.JPG' }));
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
    expect(drawnLabels(mock)).toEqual(['dianomi_1.JPG']);
  });

  it('το πλαίσιο κρατά τις ΠΡΑΓΜΑΤΙΚΕΣ 4 κορυφές — δηλαδή θέση, διαστάσεις ΚΑΙ γωνία', () => {
    // Ο Revit εξαφανίζει τον χαμένο σύνδεσμο· εδώ το πλαίσιο μένει ΑΚΡΙΒΩΣ εκεί που ανήκει το
    // υπόβαθρο, οπότε ο χρήστης ξέρει και ΤΙ λείπει και ΠΟΥ. 90° CCW γύρω από το (0,0):
    // 100×50 ⇒ x∈[-50,0], y∈[0,100] — μη-τετριμμένο σχήμα, δεν περνά με axis-aligned λάθος.
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage({ url: '', rotation: 90, sourceName: 'x.jpg' }));
    const path = mock.calls.filter((c) => c.fn === 'moveTo' || c.fn === 'lineTo');
    expect(path).toHaveLength(4);
    const spread = (i: number): number => {
      const v = path.map((c) => Number(c.args[i]));
      return Math.max(...v) - Math.min(...v);
    };
    // Το άνοιγμα (και όχι οι απόλυτες συντεταγμένες) είναι το αμετάβλητο: scale=1 ⇒ το screen
    // άνοιγμα ισούται με το world, ανεξάρτητα από περιθώρια χάρακα και αναστροφή Y.
    expect(spread(0)).toBeCloseTo(50, 6);   // στραμμένο: 100×50 ⇒ 50 κατά x
    expect(spread(1)).toBeCloseTo(100, 6);  // …και 100 κατά y (αν έμενε αστροφο: 100 και 50)
  });

  it('χωρίς όνομα ζωγραφίζει σκέτο πλαίσιο (μια εικόνα του χρήστη δεν έχει αναφορά)', () => {
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage({ url: '' }));
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
    expect(drawnLabels(mock)).toEqual([]);
  });

  it('η ετικέτα ΠΑΡΑΛΕΙΠΕΤΑΙ όταν το πλαίσιο είναι πολύ μικρό στην οθόνη (LOD)', () => {
    // Zoom-extents σε τοπογραφικό: ένα υπόβαθρο γίνεται 20px. Όνομα εκεί δεν διαβάζεται και
    // μόνο λερώνει το σχέδιο — ίδιο σκεπτικό με το density-LOD της γραμμοσκίασης.
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage({ url: '', width: 20, height: 8, sourceName: 'dianomi_1.JPG' }));
    expect(countCalls(mock, 'stroke')).toBeGreaterThanOrEqual(1);
    expect(drawnLabels(mock)).toEqual([]);
  });

  it('κόβει με αποσιωπητικά ένα όνομα που δεν χωρά — ποτέ υπερχείλιση πάνω στο σχέδιο', () => {
    const { renderer, mock } = makeRenderer();
    const long = '2026-07-20 - Διανομή Ευόσμου 1967-68-81 - φύλλο 1 (τετρ. 41-42-56).JPG';
    renderer.render(makeImage({ url: '', width: 100, height: 50, sourceName: long }));
    const [drawn] = drawnLabels(mock);
    expect(drawn).toBeDefined();
    expect(drawn.endsWith('…')).toBe(true);
    expect(drawn.length).toBeLessThan(long.length);
    // 90% των 100px του πλαισίου / 6px ανά χαρακτήρα = 15 χαρακτήρες, αποσιωπητικά μέσα.
    expect(drawn.length).toBeLessThanOrEqual(15);
  });

  it('όταν το url ΥΠΑΡΧΕΙ αλλά φορτώνει ακόμη, το πλαίσιο μένει ΑΝΩΝΥΜΟ', () => {
    // Η παρουσία της ετικέτας ΕΙΝΑΙ η διάκριση «λείπει» vs «έρχεται» — μηδέν νέο χρώμα.
    const { renderer, mock } = makeRenderer();
    renderer.render(makeImage({ sourceName: 'dianomi_1.JPG' }));
    expect(mockResolveArgs).toHaveLength(1);
    expect(drawnLabels(mock)).toEqual([]);
  });
});

describe('ImageRenderer — getGrips', () => {
  // ADR-654 — ο renderer ζωγραφίζει ΑΚΡΙΒΩΣ τις λαβές που πιάνει το interaction registry
  // (κοινό `getImageGrips` SSoT): MOVE + ROTATION + 4 γωνιακές + 3 μεσοπλευρικές (E/S/W).
  it('returns the SAME 9 grips as the interaction registry — render-shaped (id + isVisible + shape)', () => {
    const { renderer } = makeRenderer();
    const grips = renderer.getGrips(makeImage({ rotation: 30 }));
    expect(grips).toHaveLength(9);
    // `getGrips` returns the RENDER `GripInfo` (rendering/types). The interaction tags
    // (`gripKind`, `movesEntity`) live on the grip-types SSoT `getImageGrips` and are
    // asserted in image-grips.test.ts — the render output must NOT be judged by them.
    // The shared `toRenderGripInfo` adapter (same as ScaleBar/Line/etc.) supplies the
    // render-only `id` + `isVisible` the phase renderer needs; the old inline spread
    // dropped both, which is exactly the type error CHECK 3.29 surfaced.
    expect(grips.every((g) => g.isVisible)).toBe(true);
    expect(grips.every((g) => typeof g.id === 'string' && g.id.length > 0)).toBe(true);
    expect(grips.map((g) => g.type)).toEqual([
      'center', 'vertex',
      'corner', 'corner', 'corner', 'corner',
      'midpoint', 'midpoint', 'midpoint',
    ]);
    // ADR-654 — τα glyph shapes ΠΡΕΠΕΙ να ανατίθενται (αλλιώς move/rotation φαίνονται ως τετράγωνα):
    // move → σταυρός 4-βελών, rotation → καμπύλο βέλος, γωνίες + μεσοπλευρικές → default 'square'.
    expect(grips.map((g) => g.shape)).toEqual([
      'move', 'rotation',
      'square', 'square', 'square', 'square',
      'square', 'square', 'square',
    ]);
  });

  it('returns [] for non-image entities', () => {
    const { renderer } = makeRenderer();
    const grips = renderer.getGrips({ id: 'x', type: 'line', layerId: 'lyr_test' } as unknown as ImageEntity);
    expect(grips).toEqual([]);
  });
});

describe('ImageRenderer — hitTest (fill, rotation-aware)', () => {
  it('hits a point INSIDE the axis-aligned box', () => {
    const { renderer } = makeRenderer();
    const img = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50 });
    const inside: Point2D = { x: 50, y: 25 };
    expect(renderer.hitTest(img, inside, 0)).toBe(true);
  });

  it('misses a point OUTSIDE the axis-aligned box', () => {
    const { renderer } = makeRenderer();
    const img = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50 });
    const outside: Point2D = { x: 200, y: 200 };
    expect(renderer.hitTest(img, outside, 0)).toBe(false);
  });

  it('respects rotation: a point outside the UNROTATED box but inside the ROTATED one hits', () => {
    const { renderer } = makeRenderer();
    // 100×50 box rotated 90° CCW about (0,0): now occupies x∈[-50,0], y∈[0,100].
    const img = makeImage({ position: { x: 0, y: 0 }, width: 100, height: 50, rotation: 90 });
    const rotatedInside: Point2D = { x: -25, y: 50 };
    expect(renderer.hitTest(img, rotatedInside, 0)).toBe(true);
    const unrotatedInsideOnly: Point2D = { x: 50, y: 25 };
    expect(renderer.hitTest(img, unrotatedInsideOnly, 0)).toBe(false);
  });

  it('returns false for non-image entities', () => {
    const { renderer } = makeRenderer();
    expect(
      renderer.hitTest(
        { id: 'x', type: 'line', layerId: 'lyr_test' } as unknown as ImageEntity,
        { x: 0, y: 0 },
        5,
      ),
    ).toBe(false);
  });
});
