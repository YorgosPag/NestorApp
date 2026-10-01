/**
 * @jest-environment node
 *
 * @fileoverview 📷 **ΤΑ ΣΤΟΙΧΕΙΑ ΛΗΨΗΣ ΑΠΟ ΤΟ EXIF** (ADR-897 Φ5).
 * @related services/listings/photo-capture-facts · lib/listings/photo-capture-spot (`horizontalFovFromExif`)
 *
 * Ε1 — όρθια φωτογραφία ⇒ στενότερο πεδίο· **και** όταν η «όρθια» είναι αποθηκευμένη οριζόντια με `Orientation = 6`;
 * Ε2 — πυξίδα με σύστημα αναφοράς (`T`/`M`) · άκυρη ⇒ `null`;
 * Ε3 — 🔒 ζητούνται **μόνο** οι τρεις ετικέτες — ποτέ γεωγραφικό πλάτος/μήκος;
 * Ε4 — ποτέ δεν πετά: χαλασμένα bytes ⇒ «δεν ξέρουμε».
 *
 * 🔑 Το `sharp` είναι **πραγματικό** (διαστάσεις + προσανατολισμός — η παγίδα που κρίνεται)· το `exifr` είναι ψεύτικο,
 * ώστε κάθε ετικέτα να ελέγχεται χωρίς να χρειαστεί αρχείο κάμερας.
 */

import sharp from 'sharp';

import { degToRad } from '@/lib/geometry/angle';

const mockParse = jest.fn();
jest.mock('exifr', () => ({ __esModule: true, default: { parse: (...args: unknown[]) => mockParse(...args) } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readPhotoCaptureFacts } = require('../photo-capture-facts') as typeof import('../photo-capture-facts');

async function jpeg(width: number, height: number, orientation?: number): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg();
  return orientation === undefined ? image.toBuffer() : image.withMetadata({ orientation }).toBuffer();
}

beforeEach(() => mockParse.mockReset());

describe('Ε1 — όρθια όπως τη βλέπει ο θεατής', () => {
  it.each([
    ['οριζόντια', 40, 30, undefined, 36],
    ['όρθια', 30, 40, undefined, 24],
    ['αποθηκευμένη οριζόντια, Orientation 6 ⇒ όρθια', 40, 30, 6, 24],
  ])('%s', async (_label, width, height, orientation, frameMm) => {
    mockParse.mockResolvedValue({ FocalLengthIn35mmFormat: 26 });
    const facts = await readPhotoCaptureFacts(await jpeg(width, height, orientation));
    expect(facts.fovRad).toBeCloseTo(2 * Math.atan(frameMm / 52), 6);
  });

  it('χωρίς εστιακή απόσταση ⇒ `null`, ποτέ προεπιλογή', async () => {
    mockParse.mockResolvedValue({});
    expect((await readPhotoCaptureFacts(await jpeg(40, 30))).fovRad).toBeNull();
  });
});

describe('Ε2 — πυξίδα με σύστημα αναφοράς', () => {
  it.each([
    [{ GPSImgDirection: 90, GPSImgDirectionRef: 'M' }, { headingRad: degToRad(90), reference: 'magnetic' }],
    [{ GPSImgDirection: 270.5, GPSImgDirectionRef: 'T' }, { headingRad: degToRad(270.5), reference: 'true' }],
    [{ GPSImgDirection: 360 }, null],
    [{ GPSImgDirection: '90' }, null],
  ])('%p', async (tags, expected) => {
    mockParse.mockResolvedValue(tags);
    expect((await readPhotoCaptureFacts(await jpeg(40, 30))).compass).toEqual(expected);
  });
});

describe('Ε3 — 🔒 ποτέ συντεταγμένες', () => {
  it('το `pick` ζητά μόνο εστιακή + κατεύθυνση πυξίδας', async () => {
    mockParse.mockResolvedValue({});
    await readPhotoCaptureFacts(await jpeg(40, 30));
    const options = mockParse.mock.calls[0][1] as { pick: string[] };
    expect(options.pick).toEqual(['FocalLengthIn35mmFormat', 'GPSImgDirection', 'GPSImgDirectionRef']);
    expect(options.pick.join()).not.toMatch(/Latitude|Longitude|GPSPosition/u);
  });
});

describe('Ε4 — ποτέ δεν πετά', () => {
  it('χαλασμένα bytes ⇒ τίποτα γνωστό', async () => {
    mockParse.mockRejectedValue(new Error('bad'));
    await expect(readPhotoCaptureFacts(Buffer.from('not an image'))).resolves.toEqual({ fovRad: null, compass: null });
  });
});
