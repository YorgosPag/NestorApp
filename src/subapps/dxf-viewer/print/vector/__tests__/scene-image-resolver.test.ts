/**
 * ADR-909 Γ2.7 — `resolveSceneImages`: **ο τόνος της εικόνας στο vector PDF**.
 *
 * Σε `monochrome` / `grayscale` κάθε εικόνα (υλικό γραμμοσκίασης, «γυμνή» εικόνα) μπαίνει στο PDF σε κλίμακα του
 * γκρι — ό,τι κάνουν ήδη το raster PDF και η δημόσια κάτοψη. Γκρι που **δεν** παράγεται είναι αποτυχία, ποτέ
 * «δώσε την έγχρωμη».
 *
 * Το jsdom δεν έχει Canvas 2D ⇒ η αποκωδικοποίηση και η ράμπα του γκρι είναι απομιμήσεις· κρίνεται **ποια**
 * εικόνα φτάνει στο PDF (η έγχρωμη ή η γκρι), όχι τα pixels της. Η ράμπα κρίνεται στο `hatch-image-tint`.
 */

import type { Entity } from '../../../types/entities';
import { resolveSceneImages } from '../scene-image-resolver';
import { prepareExportSource, averageImageColorHex } from '../../../export/core/image-fill-export';
import { decodeImageWithTimeout } from '../../../export/core/image-export-shared';
import { toGrayscaleImage } from '../../../rendering/entities/shared/hatch-image-tint';

jest.mock('../../../export/core/image-fill-export', () => ({
  ...jest.requireActual('../../../export/core/image-fill-export'),
  prepareExportSource: jest.fn(),
  averageImageColorHex: jest.fn(),
}));
jest.mock('../../../export/core/image-export-shared', () => ({
  ...jest.requireActual('../../../export/core/image-export-shared'),
  decodeImageWithTimeout: jest.fn(),
}));
jest.mock('../../../rendering/entities/shared/hatch-image-tint', () => ({
  ...jest.requireActual('../../../rendering/entities/shared/hatch-image-tint'),
  toGrayscaleImage: jest.fn(),
}));

const ASSET = 'materials/tile/albedo.jpg';
const IMAGE_URL = 'https://example.test/tree.png';
const GREY_SUFFIX = '|plot:grey';
const HATCH_COLOUR = '#804020';

/** Ένας καμβάς με όνομα — το `toDataURL` του το επιστρέφει, ώστε να φαίνεται ΠΟΙΑ εικόνα ενσωματώθηκε. */
function namedCanvas(name: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.dataset.name = name;
  return canvas;
}

const COLOUR = namedCanvas('colour');
const GREY = namedCanvas('grey');

const hatch = (): Entity => ({
  id: 'h1', type: 'hatch', layerId: '0', fillType: 'image', color: HATCH_COLOUR,
  boundaryPaths: [[{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }]],
  imageFill: { assetId: ASSET, tileWidth: 600, tileHeight: 600 },
} as unknown as Entity);

const image = (): Entity => ({
  id: 'i1', type: 'image', layerId: '0', url: IMAGE_URL, position: { x: 0, y: 0 }, width: 1000, height: 500,
} as unknown as Entity);

let toDataURL: jest.SpyInstance;
let getContext: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function named(
    this: HTMLCanvasElement,
  ) {
    return `data:${this.dataset.name ?? 'copied'}`;
  });
  getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  (prepareExportSource as jest.Mock).mockResolvedValue({
    source: COLOUR, pixelW: 64, pixelH: 64, producedCanvas: null, originalSrc: ASSET,
  });
  (decodeImageWithTimeout as jest.Mock).mockResolvedValue(COLOUR);
  (averageImageColorHex as jest.Mock).mockReturnValue('#777777');
  (toGrayscaleImage as jest.Mock).mockReturnValue(GREY);
});

afterEach(() => {
  toDataURL.mockRestore();
  getContext.mockRestore();
});

describe('ADR-909 Γ2.7 — γέμισμα «Εικόνα» στο vector PDF', () => {
  it.each(['colour', 'by-pen'] as const)('Η1 «%s»: η εικόνα μπαίνει έγχρωμη, με το ίδιο alias όπως πριν', async (style) => {
    const result = await resolveSceneImages([hatch()], style);
    expect(toGrayscaleImage).not.toHaveBeenCalled();
    expect(result.patternCells.get('h1')).toMatchObject({ dataUrl: 'data:colour', alias: ASSET });
    expect(result.warnings).toEqual([]);
  });

  it.each(['monochrome', 'grayscale'] as const)('Η2 «%s»: η εικόνα μπαίνει ΓΚΡΙ, σε δικό της alias', async (style) => {
    const result = await resolveSceneImages([hatch()], style);
    expect(toGrayscaleImage).toHaveBeenCalledWith(COLOUR);
    expect(result.patternCells.get('h1')).toMatchObject({ dataUrl: 'data:grey', alias: `${ASSET}${GREY_SUFFIX}` });
    expect(result.warnings).toEqual([]);
  });

  it('Η3 το μέσο χρώμα της εφεδρείας διαβάζεται από τη ΓΚΡΙ εικόνα, όχι από την έγχρωμη', async () => {
    await resolveSceneImages([hatch()], 'monochrome');
    expect(averageImageColorHex).toHaveBeenCalledTimes(1);
    expect(averageImageColorHex).toHaveBeenCalledWith(GREY);
  });

  it('Η4 γκρι που ΔΕΝ παράγεται ⇒ αποτυχία με ειδοποίηση — η έγχρωμη εικόνα δεν ενσωματώνεται ποτέ', async () => {
    (toGrayscaleImage as jest.Mock).mockReturnValue(null);
    const result = await resolveSceneImages([hatch()], 'monochrome');
    expect(result.patternCells.size).toBe(0);
    expect(result.solidFallbacks.get('h1')).toBe(HATCH_COLOUR);
    expect(result.warnings).toEqual(['image-fill:decode-failed']);
    expect(toDataURL).not.toHaveBeenCalled();
  });

  it('Η5 η ίδια αποτυχία του γκρι ΔΕΝ αγγίζει το «Έγχρωμο»', async () => {
    (toGrayscaleImage as jest.Mock).mockReturnValue(null);
    const result = await resolveSceneImages([hatch()], 'colour');
    expect(result.patternCells.get('h1')).toMatchObject({ dataUrl: 'data:colour' });
    expect(result.warnings).toEqual([]);
  });
});

describe('ADR-909 Γ2.7 — «γυμνή» εικόνα στο vector PDF', () => {
  it('Θ1 «Έγχρωμο»: έγχρωμη, alias = το url όπως πριν', async () => {
    const result = await resolveSceneImages([image()], 'colour');
    expect(toGrayscaleImage).not.toHaveBeenCalled();
    expect(result.images.get('i1')).toMatchObject({ dataUrl: 'data:colour', alias: IMAGE_URL });
  });

  it.each(['monochrome', 'grayscale'] as const)('Θ2 «%s»: ΓΚΡΙ, σε δικό της alias', async (style) => {
    const result = await resolveSceneImages([image()], style);
    expect(toGrayscaleImage).toHaveBeenCalledWith(COLOUR);
    expect(result.images.get('i1')).toMatchObject({ dataUrl: 'data:grey', alias: `${IMAGE_URL}${GREY_SUFFIX}` });
    expect(result.warnings).toEqual([]);
  });

  it('Θ3 γκρι που ΔΕΝ παράγεται ⇒ η εικόνα λείπει ΚΑΙ αναφέρεται — ποτέ έγχρωμη σε ασπρόμαυρο', async () => {
    (toGrayscaleImage as jest.Mock).mockReturnValue(null);
    const result = await resolveSceneImages([image()], 'grayscale');
    expect(result.images.size).toBe(0);
    expect(result.warnings).toEqual(['image-entity:decode-failed']);
    expect(toDataURL).not.toHaveBeenCalled();
  });
});
