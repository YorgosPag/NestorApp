/**
 * ADR-909 Β2.6 / ADR-643 / ADR-507 / ADR-454 — ΑΓΚΥΡΕΣ του print pass: **εικόνες**, **πένα γραμμοσκίασης**,
 * **ετικέτα ανοίγματος**.
 *
 * Μετρημένο ζωντανά (2026-10-09, «95 τ.μ.», δημόσια κάτοψη 3732×4096, `monochrome`):
 *   • `cobblestone/albedo.jpg` και `tile/albedo.jpg` ζητήθηκαν τη στιγμή της λήψης και αποκωδικοποιήθηκαν
 *     55 και 30 ms **μετά** τη ζωγραφική ⇒ δύο δωμάτια επίπεδο γκρι `#808080` α 0,45·
 *   • οι διαγώνιες γραμμές βγήκαν **0,5 px**, γκρι, δίπλα σε τοίχους 4,92 px μαύρους·
 *   • τα μόνα χρωματιστά pixels της εικόνας (198) ήταν η ετικέτα της πόρτας.
 *
 *   Ζ1  🔴 το `resolve()` μόνο του ΔΕΝ φέρνει την εικόνα (η βλάβη)· μετά το `preload()` είναι εκεί, σύγχρονα
 *   Ζ2  εικόνα που δεν φορτώνει ⇒ `preload` = false, ποτέ εξαίρεση, ποτέ αιώνιο `loading`· ξαναδοκιμάζεται
 *   Ζ3  το κλειδί: οθόνη = το ιστορικό · `colour` = ίδιο με την οθόνη · `monochrome`/`grayscale` = άλλο
 *   Ζ4  🔴 γκρι που ΔΕΝ μπορεί να παραχθεί ⇒ ΑΠΟΤΥΧΙΑ — ποτέ η έγχρωμη εικόνα σε ασπρόμαυρο χαρτί
 *   Ζ5  προφόρτωση σκηνής: ζεσταίνει ό,τι θα ζητήσει ο αποδότης· ό,τι δεν ήρθε ΟΝΟΜΑΖΕΤΑΙ, ανά οντότητα
 *   Ζ6  πένα γραμμοσκίασης σε print pass: dpi + δάπεδο της απόδοσης · PDF χωρίς δάπεδο · 🔑 οθόνη ΟΠΩΣ ΠΡΙΝ
 *   Ζ7  ετικέτα ανοίγματος σε `monochrome`: μελάνι μαύρο, χαπάκι χαρτί · 🔑 οθόνη ΟΠΩΣ ΠΡΙΝ
 */

import { drawLeaderLine, drawPillTag } from '../../bim/renderers/OpeningTagRenderer';
import { OPENING_TAG_STYLE_DEFAULTS } from '../../bim/services/opening-tag-style-service';
import {
  DEFAULT_HATCH_CONTOUR_WIDTH_PX,
  DEFAULT_HATCH_LINE_WIDTH_PX,
  resolveHatchContourWidthPx,
  resolveHatchLineWidthPx,
} from '../../bim/hatch/hatch-properties';
import { lineweightToPx } from '../../config/lineweight-iso-catalog';
import {
  PRINT_PAPER_HEX,
  clearPrintColorPolicy,
  plotStyleGreysImages,
  setPrintColorPolicy,
  type PrintColorPolicy,
} from '../../config/print-color-policy';
import { HatchImageCache } from '../../rendering/entities/shared/hatch-image-cache';
import { imageFillVariantKey } from '../../rendering/entities/shared/hatch-image-variant-key';
import {
  hatchFillImageCache,
  imageEntityResolveSpec,
  imageFillResolveSpec,
} from '../../rendering/entities/shared/shared-image-caches';
import { __resetLineweightDisplayForTesting } from '../../stores/LineweightDisplayStore';
import type { HatchImageFill, LineweightMm } from '../../types/entities';
import { missingSceneImageWarnings, preloadSceneImages } from '../capture/preload-scene-images';

const PUBLIC_IMAGE: PrintColorPolicy = { style: 'monochrome', dpi: 694, minLineWidthPx: 4 };
const PAPER_PDF: PrintColorPolicy = { style: 'monochrome', dpi: 300 };
const MM_PER_INCH = 25.4;

/** Το `decode()` του jsdom δεν υπάρχει — εδώ αποφασίζει το test αν πετυχαίνει. */
let decodeOutcome: 'ok' | 'fail' = 'ok';

beforeAll(() => {
  (HTMLImageElement.prototype as unknown as { decode: () => Promise<void> }).decode = () =>
    decodeOutcome === 'ok' ? Promise.resolve() : Promise.reject(new Error('decode failed'));
});

beforeEach(() => {
  decodeOutcome = 'ok';
  clearPrintColorPolicy();
  __resetLineweightDisplayForTesting();
});
afterEach(clearPrintColorPolicy);

const freshCache = (): HatchImageCache => new HatchImageCache(jest.fn(), async (id) => `https://example.test/${id}.jpg`);

describe('Ζ1–Ζ2 — η εικόνα πριν από τον σύγχρονο αποδότη', () => {
  it('Ζ1 🔴 το `resolve()` μόνο του δεν τη φέρνει· μετά το `preload()` είναι εκεί, σύγχρονα', async () => {
    const cache = freshCache();

    // Η βλάβη: ένας αποδότης που ζωγραφίζει ΜΙΑ φορά παίρνει `null` και βάφει επίπεδο χρώμα.
    expect(cache.resolve('stone')).toBeNull();
    expect(cache.isReady('stone')).toBe(false);

    expect(await cache.preload('stone')).toBe(true);
    expect(cache.isReady('stone')).toBe(true);
    expect(cache.resolve('stone')).not.toBeNull();
  });

  it('Ζ1β το `preload()` σε ήδη έτοιμη εικόνα δεν ξαναφορτώνει', async () => {
    const resolveSrc = jest.fn(async (id: string) => `https://example.test/${id}.jpg`);
    const cache = new HatchImageCache(jest.fn(), resolveSrc);

    await cache.preload('stone');
    await cache.preload('stone');

    expect(resolveSrc).toHaveBeenCalledTimes(1);
  });

  it('Ζ2 εικόνα που δεν φορτώνει ⇒ false, χωρίς εξαίρεση· η επόμενη προσπάθεια ξαναδοκιμάζει', async () => {
    const cache = freshCache();
    decodeOutcome = 'fail';
    expect(await cache.preload('stone')).toBe(false);
    expect(cache.isReady('stone')).toBe(false);

    decodeOutcome = 'ok';
    expect(await cache.preload('stone')).toBe(true);
  });

  it('Ζ2β ακόμη κι αν πετάξει η ανάλυση του src ⇒ false, ποτέ αιώνιο `loading`', async () => {
    const cache = new HatchImageCache(jest.fn(), async () => { throw new Error('catalog down'); });

    expect(await cache.preload('stone')).toBe(false);
    expect(await cache.preload('stone')).toBe(false);
  });
});

describe('Ζ3–Ζ4 — ο τόνος της εικόνας', () => {
  const FILL = { assetId: 'stone', tileWidth: 300, tileHeight: 300 } as unknown as HatchImageFill;

  it('Ζ3 οθόνη = το ιστορικό κλειδί · `colour` = ίδιο · `monochrome`/`grayscale` = άλλη εγγραφή', () => {
    const screen = imageFillResolveSpec(FILL, null);
    expect(screen.key).toBe(imageFillVariantKey(FILL));
    expect(screen.grayscale).toBeUndefined();

    expect(imageFillResolveSpec(FILL, 'colour')).toStrictEqual(screen);
    expect(imageFillResolveSpec(FILL, 'by-pen')).toStrictEqual(screen);

    for (const style of ['monochrome', 'grayscale'] as const) {
      const grey = imageFillResolveSpec(FILL, style);
      expect(grey.key).not.toBe(screen.key);
      expect(grey.grayscale).toBe(true);
      expect(plotStyleGreysImages(style)).toBe(true);
    }
    // Και η «γυμνή» εικόνα υπακούει στον ΙΔΙΟ κανόνα.
    expect(imageEntityResolveSpec('https://x.test/a.png', null).key).toBe('https://x.test/a.png');
    expect(imageEntityResolveSpec('https://x.test/a.png', 'monochrome').grayscale).toBe(true);
  });

  it('Ζ4 🔴 γκρι που δεν μπορεί να παραχθεί ⇒ αποτυχία, ποτέ η έγχρωμη εικόνα', async () => {
    // Το jsdom δεν έχει 2D context ⇒ η μετατροπή σε γκρι επιστρέφει `null` — ό,τι και ένα cross-origin taint.
    const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const cache = freshCache();

    expect(await cache.preload(imageFillResolveSpec(FILL, 'monochrome'))).toBe(false);
    expect(cache.resolve(imageFillResolveSpec(FILL, 'monochrome'))).toBeNull();
    // Η έγχρωμη, με το δικό της κλειδί, μένει ανέγγιχτη και φορτώνει κανονικά.
    expect(await cache.preload(imageFillResolveSpec(FILL, null))).toBe(true);

    getContext.mockRestore();
  });
});

describe('Ζ5 — προφόρτωση σκηνής και ονομασμένη απώλεια', () => {
  const hatch = (id: string, assetId: string) => ({
    id, type: 'hatch', fillType: 'image', imageFill: { assetId, tileWidth: 300, tileHeight: 300 } as unknown as HatchImageFill,
  });

  it('ζεσταίνει ό,τι θα ζητήσει ο αποδότης — με το ΙΔΙΟ κλειδί', async () => {
    const scene = [hatch('h1', '/textures/z5-a.jpg'), hatch('h2', '/textures/z5-a.jpg'), { id: 'l', type: 'line' }];

    expect(missingSceneImageWarnings(scene, 'colour')).toStrictEqual([
      'image-fill:decode-failed', 'image-fill:decode-failed',
    ]);

    await preloadSceneImages(scene, 'colour');

    expect(missingSceneImageWarnings(scene, 'colour')).toStrictEqual([]);
    // Ο αποδότης θα ρωτήσει ακριβώς αυτό — και θα το βρει έτοιμο, σύγχρονα.
    expect(hatchFillImageCache.resolve(imageFillResolveSpec(scene[0].imageFill as HatchImageFill, 'colour'))).not.toBeNull();
  });

  it('ό,τι δεν ήρθε ονομάζεται ανά οντότητα· η προφόρτωση δεν πετά', async () => {
    decodeOutcome = 'fail';
    const scene = [hatch('h1', '/textures/z5-broken.jpg'), { id: 'i1', type: 'image', url: 'https://x.test/z5-broken.png' }];

    await expect(preloadSceneImages(scene, 'colour')).resolves.toBeUndefined();

    expect(missingSceneImageWarnings(scene, 'colour')).toStrictEqual([
      'image-fill:decode-failed', 'image-entity:decode-failed',
    ]);
  });

  it('«γυμνή» εικόνα χωρίς `url` είναι ανεπίλυτη αναφορά — άλλος κωδικός, καμία απόπειρα φόρτωσης', async () => {
    const scene = [{ id: 'i1', type: 'image', url: '' }];
    await preloadSceneImages(scene, 'colour');
    expect(missingSceneImageWarnings(scene, 'colour')).toStrictEqual(['image-entity:unresolved-reference']);
  });
});

describe('Ζ6 — η πένα της γραμμοσκίασης', () => {
  it('🔑 οθόνη ΟΠΩΣ ΠΡΙΝ: 0,5 px χωρίς πάχος · LWT στα 96 dpi με πάχος · περίγραμμα 1 px', () => {
    expect(resolveHatchLineWidthPx(undefined)).toBe(DEFAULT_HATCH_LINE_WIDTH_PX);
    expect(resolveHatchLineWidthPx(0.5 as LineweightMm)).toBeCloseTo(lineweightToPx(0.5 as LineweightMm), 5);
    expect(resolveHatchContourWidthPx(undefined)).toBe(DEFAULT_HATCH_CONTOUR_WIDTH_PX);
    expect(resolveHatchContourWidthPx(0.5 as LineweightMm)).toBeCloseTo(lineweightToPx(0.5 as LineweightMm), 5);
  });

  it('🔴 δημόσια κάτοψη: χωρίς πάχος ⇒ το ΔΑΠΕΔΟ της απόδοσης (4 px), όχι 0,5 px', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    expect(resolveHatchLineWidthPx(undefined)).toBe(4);
    expect(resolveHatchLineWidthPx(null)).toBe(4);
  });

  it('🔴 δημόσια κάτοψη: ρητό πάχος ⇒ στο dpi της ΑΠΟΔΟΣΗΣ, όχι στα 96 της οθόνης', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    expect(resolveHatchLineWidthPx(0.5 as LineweightMm)).toBeCloseTo((0.5 * 694) / MM_PER_INCH, 5);
    expect(resolveHatchContourWidthPx(undefined)).toBeCloseTo((0.18 * 694) / MM_PER_INCH, 5);
  });

  it('η γραμμοσκίαση είναι ΛΕΠΤΟΤΕΡΗ από το περίγραμμά της (ISO 128), και σε χαρτί χωρίς δάπεδο', () => {
    setPrintColorPolicy(PAPER_PDF);
    const line = resolveHatchLineWidthPx(undefined);
    const contour = resolveHatchContourWidthPx(undefined);
    expect(line).toBeCloseTo((0.13 * 300) / MM_PER_INCH, 5);
    expect(contour).toBeGreaterThan(line);
  });
});

describe('Ζ7 — η ετικέτα ανοίγματος', () => {
  const DOOR_ORANGE = '#c97c2f';

  /** Πλαστό context: θυμάται το μελάνι κάθε `stroke()` / `fill()` / `fillText()`. */
  function inkRecorder(): { ctx: CanvasRenderingContext2D; strokes: string[]; fills: string[] } {
    const strokes: string[] = [];
    const fills: string[] = [];
    const state = { strokeStyle: '', fillStyle: '' } as Record<string, unknown>;
    const ctx = new Proxy(state, {
      get(target, prop: string) {
        if (prop === 'stroke') return () => { strokes.push(String(target.strokeStyle)); };
        if (prop === 'fill' || prop === 'fillText') return () => { fills.push(String(target.fillStyle)); };
        if (prop === 'measureText') return () => ({ width: 20 });
        return prop in target ? target[prop] : () => undefined;
      },
      set(target, prop: string, value) { target[prop] = value; return true; },
    });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, fills };
  }

  function drawTag(): { strokes: string[]; fills: string[] } {
    const rec = inkRecorder();
    drawLeaderLine(rec.ctx, { x: 0, y: 0 }, { x: 100, y: 60 });
    drawPillTag(rec.ctx, { x: 100, y: 60 }, 'Θ.001', DOOR_ORANGE);
    return rec;
  }

  it('🔑 οθόνη ΟΠΩΣ ΠΡΙΝ: οδηγός στο χρώμα του στυλ, περίγραμμα στο χρώμα του είδους', () => {
    const { strokes, fills } = drawTag();
    expect(strokes).toStrictEqual([OPENING_TAG_STYLE_DEFAULTS.leaderColor, DOOR_ORANGE]);
    expect(fills[0]).toBe(OPENING_TAG_STYLE_DEFAULTS.pillBgColor);
  });

  it('🔴 `monochrome` ⇒ κάθε μελάνι μαύρο, το χαπάκι χαρτί — κανένα χρωματιστό pixel', () => {
    setPrintColorPolicy(PUBLIC_IMAGE);
    const { strokes, fills } = drawTag();
    expect(strokes).toStrictEqual(['#000000', '#000000']);
    expect(fills).toStrictEqual([PRINT_PAPER_HEX, '#000000']);
  });
});
