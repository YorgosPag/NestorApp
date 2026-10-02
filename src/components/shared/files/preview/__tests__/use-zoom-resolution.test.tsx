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
 */

import { act, renderHook } from '@testing-library/react';

import { buildProxyPreview } from '@/lib/storage/storage-object-url';

import { useZoomResolution, zoomSourceOf, zoomUpgradeOf } from '../use-zoom-resolution';

const ORIGINAL = '/api/storage/file/a/photo.jpg';
const PREVIEW = buildProxyPreview('a/photo.jpg');
const BOX = 600;

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
});

beforeEach(() => {
  decodes.length = 0;
});

function containerRef() {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => ({ width: BOX, height: 400 }) as DOMRect;
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
    const capped = buildProxyPreview('a/photo.jpg', 'legacy-default', 1183);
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
