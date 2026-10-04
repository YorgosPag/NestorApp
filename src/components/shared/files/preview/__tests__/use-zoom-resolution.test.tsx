/**
 * ADR-899 §4.1 — **η ανάλυση ακολουθεί το zoom**, μόνο προς τα πάνω, και αλλάζει **μετά** την αποκωδικοποίηση.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ζ1: η αναβάθμιση γίνεται και προς τα κάτω (ξεζούμ ⇒ ξανακατέβασμα) ή σε ίδια βαθμίδα.
 * - Ζ2: πήδημα κατευθείαν στο πρωτότυπο αντί για τη μικρότερη επαρκή βαθμίδα.
 * - Ζ3: η πηγή αλλάζει ΠΡΙΝ το `decode()` (λευκό αναβόσβημα).
 * - Ζ4: zoom 1 φορτώνει κάτι.
 * - Ζ5: χωρίς `preview` αλλάζει η σημερινή συμπεριφορά (`url` αυτούσιο).
 * - Ζ6: το `sizes` δεν είναι το μετρημένο κουτί.
 * - Ζ8 (§9 Ε2β): το `sizes` είναι ολόκληρο το κουτί αντί για ό,τι **ζωγραφίζεται** (κάθετη σε οριζόντιο κουτί ⇒ `w=2560`
 *   αντί για `w=640`, μετρημένο ζωντανά 2026-10-03).
 * - Ζ9 (§9 Ε4γ, αντιστράφηκε 2026-10-04): η περιστροφή **ξαναμπαίνει** στην ερώτηση. Το `scale(z) rotate(r)` δεν κάνει
 *   layout — ο άξονας πλάτους της εικόνας ζωγραφίζεται στο ίδιο μήκος σε κάθε γωνία· η παλιά «στροφή = άλλο κουτί» ζητούσε
 *   936 αντί για 702 ⇒ `w=1280` (287 KB) χωρίς κέρδος. Η άγκυρα συμπεριφοράς ζει στο `image-preview-rotation.test.tsx`.
 * - Ζ10 (§9 Ε4ε): το κουτί μετριέται border-box ⇒ το padding (`p-4`) μετρά ως χώρος της εικόνας (+55 px μετρημένα).
 */

import { act, renderHook } from '@testing-library/react';

import { buildProxyPreview } from '@/lib/storage/storage-object-url';

import { paintedWidthOf, useZoomResolution, zoomSourceOf, zoomUpgradeOf } from '../use-zoom-resolution';

const ORIGINAL = '/api/storage/file/a/photo.jpg';
const PREVIEW = buildProxyPreview('a/photo.jpg');
const PORTRAIT = buildProxyPreview('a/photo.jpg', 'legacy-default', { width: 3000, height: 4000 });
/** Μετρημένο κουτί σε σκαλοπάτια των 16 ⇒ άνω φράγμα +8: 592×400 ⇒ **600×408**. */
const BOX_RECT = { width: 592, height: 400 };
const BOX = 600;
const BOX_HEIGHT = 408;

const decodes: Array<{ src: string; resolve: () => void }> = [];

beforeAll(() => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
  class FakeImage {
    src = '';
    decode(): Promise<void> {
      return new Promise((resolve) => decodes.push({ src: this.src, resolve }));
    }
  }
  (globalThis as { Image: unknown }).Image = FakeImage;
  // Το κουτί μετριέται από το SSoT `useElementSize` — χωρίς `ResizeObserver` (jsdom) μένει ειλικρινά «άγνωστο».
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  decodes.length = 0;
});

function containerRef(padding = 0) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => BOX_RECT as DOMRect;
  if (padding > 0) element.style.padding = `${padding}px`;
  return { current: element };
}

describe('zoomUpgradeOf / zoomSourceOf — καθαρή απόφαση', () => {
  it('🔴 Ζ1 μόνο αυστηρά προς τα πάνω', () => {
    expect(zoomUpgradeOf(1280, 1000)).toBeNull();
    expect(zoomUpgradeOf(1280, 1280)).toBeNull();
    expect(zoomUpgradeOf('original', 99_999)).toBeNull();
    expect(zoomUpgradeOf(1280, 1281)).toBe(2560);
    // ξεζούμ από υψηλή βαθμίδα: ανάγκη για 1280 ενώ έχουμε 2560/πρωτότυπο ⇒ τίποτα
    expect(zoomUpgradeOf(2560, 700)).toBeNull();
    expect(zoomUpgradeOf('original', 1800)).toBeNull();
  });

  it('🔴 Ζ2 η μικρότερη επαρκής βαθμίδα — πρωτότυπο μόνο πάνω από την κορυφή', () => {
    expect(zoomUpgradeOf(1280, 2400)).toBe(2560);
    expect(zoomUpgradeOf(2560, 2561)).toBe('original');
    expect(zoomSourceOf(PREVIEW, ORIGINAL, 2560)).toBe(PREVIEW.ladder.find((rung) => rung.width === 2560)?.src);
    expect(zoomSourceOf(PREVIEW, ORIGINAL, 'original')).toBe(ORIGINAL);
  });

  it('🔴 Ζ7 (ADR-899 §3.7) πρωτότυπο 1183 px: καμία βαθμίδα πάνω από αυτό — ανάγκη πέρα από τα pixel του ⇒ πρωτότυπο', () => {
    expect(zoomUpgradeOf(640, 1000, 1183)).toBe(1280);
    expect(zoomUpgradeOf(1280, 1500, 1183)).toBe('original');
    expect(zoomUpgradeOf(1280, 2400, 1183)).toBe('original');
    const capped = buildProxyPreview('a/photo.jpg', 'legacy-default', { width: 1183, height: 887 });
    expect(capped.ladder.map((rung) => rung.width)).toEqual([320, 640, 1280]);
    expect(zoomSourceOf(capped, ORIGINAL, 'original')).toBe(ORIGINAL);
  });
});

describe('useZoomResolution', () => {
  it('🔴 Ζ5 χωρίς preview ⇒ το url αυτούσιο', () => {
    const { result } = renderHook(() => useZoomResolution(ORIGINAL, null, containerRef(), 3));
    expect(result.current).toEqual({ src: ORIGINAL });
  });

  it('🔴 Ζ4+Ζ6 zoom 1 ⇒ srcset με `sizes` = μετρημένο κουτί, καμία φόρτωση', () => {
    const { result } = renderHook(() => useZoomResolution(ORIGINAL, PREVIEW, containerRef(), 1));
    expect(result.current).toEqual({ src: PREVIEW.src, srcSet: PREVIEW.srcSet, sizes: `${BOX}px` });
    expect(decodes).toHaveLength(0);
  });

  it('🔴 Ζ3 zoom 2 (600×2×DPR2 = 2400) ⇒ w=2560, ΑΛΛΑ μόνο μετά το decode', async () => {
    const ref = containerRef();
    const { result } = renderHook(({ zoom }) => useZoomResolution(ORIGINAL, PREVIEW, ref, zoom), {
      initialProps: { zoom: 2 },
    });
    expect(decodes.map((entry) => entry.src)).toEqual([zoomSourceOf(PREVIEW, ORIGINAL, 2560)]);
    expect(result.current.srcSet).toBe(PREVIEW.srcSet);
    await act(async () => decodes[0].resolve());
    expect(result.current).toEqual({ src: zoomSourceOf(PREVIEW, ORIGINAL, 2560) });
  });

  it('🔴 Ζ1 ξεζούμ μετά την αναβάθμιση ⇒ μένει η μεγάλη, καμία νέα φόρτωση', async () => {
    const ref = containerRef();
    const { result, rerender } = renderHook(({ zoom }) => useZoomResolution(ORIGINAL, PREVIEW, ref, zoom), {
      initialProps: { zoom: 2 },
    });
    await act(async () => decodes[0].resolve());
    rerender({ zoom: 1 });
    expect(result.current).toEqual({ src: zoomSourceOf(PREVIEW, ORIGINAL, 2560) });
    expect(decodes).toHaveLength(1);
  });
});

describe('paintedWidthOf — ό,τι ζωγραφίζεται (ADR-899 §9 Ε2β)', () => {
  const portrait = { width: 3000, height: 4000 };

  it('🔴 Ζ8 η μετρημένη περίπτωση: κάθετη 3000×4000 σε κουτί 2352×928 ⇒ 696, όχι 2352', () => {
    expect(paintedWidthOf({ width: 2352, height: 928 }, portrait)).toBe(696);
    // χωρίς διαστάσεις: το πλάτος του κουτιού (ποτέ θόλωμα)
    expect(paintedWidthOf({ width: 2352, height: 928 }, null)).toBe(2352);
    expect(paintedWidthOf({ width: 0, height: 0 }, portrait)).toBe(0);
  });
});

describe('useZoomResolution — ζωγραφισμένο πλάτος (ADR-899 §9 Ε2β · Ε4ε)', () => {
  it('🔴 Ζ8 κάθετη με γνωστές διαστάσεις ⇒ `sizes` = ζωγραφισμένο (408 × ¾ = 306), όχι το κουτί', () => {
    const { result } = renderHook(() => useZoomResolution(ORIGINAL, PORTRAIT, containerRef(), 1));
    expect(result.current.sizes).toBe(`${Math.ceil((BOX_HEIGHT * 3) / 4)}px`);
    expect(decodes).toHaveLength(0);
  });

  it('🔴 Ζ10 (Ε4ε) padding 16 ⇒ content-box 560×368 ⇒ άνω φράγμα 568×376 ⇒ κάθετη 376 × ¾ = 282, όχι 306', () => {
    const { result } = renderHook(() => useZoomResolution(ORIGINAL, PORTRAIT, containerRef(16), 1));
    expect(result.current.sizes).toBe('282px');
    const free = renderHook(() => useZoomResolution(ORIGINAL, PREVIEW, containerRef(16), 1));
    expect(free.result.current.sizes).toBe('568px');
    expect(decodes).toHaveLength(0);
  });

  it('🔴 Ζ8 το zoom πολλαπλασιάζει το ζωγραφισμένο: 306 × 3 × DPR2 = 1836 ⇒ w=2560, όχι πρωτότυπο', () => {
    renderHook(() => useZoomResolution(ORIGINAL, PORTRAIT, containerRef(), 3));
    expect(decodes.map((entry) => entry.src)).toEqual([zoomSourceOf(PORTRAIT, ORIGINAL, 2560)]);
  });
});
