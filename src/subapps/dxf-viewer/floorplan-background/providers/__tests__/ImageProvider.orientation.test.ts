/**
 * Άγκυρα: ΜΙΑ πηγή αλήθειας για τον προσανατολισμό EXIF στο υπόβαθρο κάτοψης (ADR-899 §9 · ADR-340).
 *
 * Ο decoder του browser (`createImageBitmap`, `imageOrientation: 'from-image'`) εφαρμόζει ήδη τον EXIF.
 * Μετρημένο στον Chrome 154 με πραγματικό JPEG (κωδικοποιημένο 2400×1800, `Orientation = 6`): bitmap
 * 1800×2400. Η παλιά χειροκίνητη στροφή από `exifr` το ξαναγύριζε ⇒ 2400×1800 (πλαγιαστή κάτοψη).
 *
 * Το jsdom δεν έχει decoder ⇒ το mock **μιμείται τον browser**: επιστρέφει τις προσανατολισμένες
 * διαστάσεις και καταγράφει τα options που ζητήθηκαν.
 */

jest.mock('exifr', () => ({ __esModule: true, default: { parse: jest.fn() } }));
jest.mock('utif', () => ({ decode: jest.fn(), decodeImages: jest.fn(), toRGBA8: jest.fn() }));

import exifr from 'exifr';
import { ImageProvider } from '../ImageProvider';

interface FakeContext {
  readonly drawImage: jest.Mock;
  readonly transform: jest.Mock;
  readonly putImageData: jest.Mock;
}

const canvases: Array<{ width: number; height: number; ctx: FakeContext }> = [];

class FakeOffscreenCanvas {
  readonly ctx: FakeContext = { drawImage: jest.fn(), transform: jest.fn(), putImageData: jest.fn() };
  constructor(public width: number, public height: number) {
    canvases.push(this);
  }
  getContext(): FakeContext {
    return this.ctx;
  }
}

const createImageBitmapMock = jest.fn();
const parseMock = exifr.parse as unknown as jest.Mock;

/** Ο browser: `from-image` ⇒ οι τέταρτες στροφές (5–8) ανταλλάσσουν τις κωδικοποιημένες διαστάσεις. */
function browserDecodes(encoded: { width: number; height: number }, orientation: number): void {
  const quarterTurn = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  createImageBitmapMock.mockResolvedValue({
    width: quarterTurn ? encoded.height : encoded.width,
    height: quarterTurn ? encoded.width : encoded.height,
    close: jest.fn(),
  });
  parseMock.mockResolvedValue(orientation === 1 ? null : { Orientation: orientation });
}

const jpeg = () => ({ kind: 'file' as const, file: new File([new Uint8Array(4)], 'phone.jpg', { type: 'image/jpeg' }) });

beforeAll(() => {
  Object.assign(globalThis, { OffscreenCanvas: FakeOffscreenCanvas, createImageBitmap: createImageBitmapMock });
});

beforeEach(() => {
  canvases.length = 0;
  createImageBitmapMock.mockReset();
  parseMock.mockReset();
});

describe('ImageProvider — προσανατολισμός EXIF', () => {
  it('Ο1: λήψη κινητού (EXIF 6, 2400×1800) ⇒ όρθια 1800×2400, η τιμή EXIF μένει ως πληροφορία', async () => {
    browserDecodes({ width: 2400, height: 1800 }, 6);
    const result = await new ImageProvider().loadAsync(jpeg());

    expect(result).toEqual({ success: true, bounds: { width: 1800, height: 2400 }, metadata: { imageOrientation: 6 } });
  });

  it('Ο2: ο decoder καλείται με imageOrientation: from-image', async () => {
    browserDecodes({ width: 2400, height: 1800 }, 6);
    await new ImageProvider().loadAsync(jpeg());

    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: 'from-image' });
  });

  it('Ο3: EXIF 3 (180°) ⇒ ένα μόνο canvas, καμία χειροκίνητη στροφή', async () => {
    browserDecodes({ width: 1200, height: 800 }, 3);
    const result = await new ImageProvider().loadAsync(jpeg());

    expect(canvases).toHaveLength(1);
    expect(canvases[0].ctx.transform).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, bounds: { width: 1200, height: 800 } });
  });

  it('Ο4: χωρίς EXIF ⇒ imageOrientation 1, ίδιες διαστάσεις', async () => {
    browserDecodes({ width: 1200, height: 800 }, 1);
    const result = await new ImageProvider().loadAsync(jpeg());

    expect(result).toEqual({ success: true, bounds: { width: 1200, height: 800 }, metadata: { imageOrientation: 1 } });
  });
});
