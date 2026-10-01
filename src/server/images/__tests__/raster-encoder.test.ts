/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΕΝΑΣ κωδικοποιητής raster** (ADR-899 §3) — πραγματικό `sharp` σε συνθετικές εικόνες.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Κ1: χάνεται το `withoutEnlargement` ⇒ μικρό πρωτότυπο μεγεθύνεται (θόλωμα + bytes χωρίς λόγο).
 * - Κ2: κουτί `width` συμπεριφέρεται ως «μέγιστη πλευρά» ⇒ ο περιγραφέας `w` του srcset λέει ψέματα.
 * - Κ3: προστίθεται `withMetadata()` ⇒ το EXIF (με GPS) διαρρέει στο παράγωγο.
 * - Κ4: χάνεται το `.rotate()` ⇒ φωτογραφία κινητού γυρισμένη στο πλάι.
 */

jest.mock('server-only', () => ({}));

import sharp from 'sharp';

import { decodeOriented, encodeRasterDerivative } from '../raster-encoder';
import type { RasterShelfEncoding } from '@/services/upload/utils/public-shelf-encoding';

const ENCODING: RasterShelfEncoding = { kind: 'raster', widths: [320], quality: 80, preset: 'photo' };

function jpeg(width: number, height: number, options: { orientation?: number; exif?: boolean } = {}): Promise<Buffer> {
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg();
  if (options.exif === true || options.orientation !== undefined) {
    pipeline = pipeline.withMetadata({
      orientation: options.orientation,
      exif: options.exif === true ? { IFD0: { Copyright: 'nestor-test' } } : undefined,
    });
  }
  return pipeline.toBuffer();
}

describe('encodeRasterDerivative', () => {
  it('🔴 Κ2 κουτί «width»: το πλάτος είναι το όριο, και σε ψηλή εικόνα', async () => {
    const tall = await jpeg(800, 2000);
    const out = await encodeRasterDerivative(decodeOriented(tall), { fit: 'width', px: 320 }, ENCODING, 4);
    expect([out.width, out.height]).toEqual([320, 800]);
    expect(out.contentType).toBe('image/webp');
    expect((await sharp(out.bytes).metadata()).format).toBe('webp');
  });

  it('κουτί «max-edge» (το ράφι): καμία πλευρά πάνω από px', async () => {
    const tall = await jpeg(800, 2000);
    const out = await encodeRasterDerivative(decodeOriented(tall), { fit: 'max-edge', px: 320 }, ENCODING, 4);
    expect([out.width, out.height]).toEqual([128, 320]);
  });

  it('🔴 Κ1 ποτέ μεγέθυνση', async () => {
    const small = await jpeg(200, 100);
    const out = await encodeRasterDerivative(decodeOriented(small), { fit: 'width', px: 2560 }, ENCODING, 4);
    expect([out.width, out.height]).toEqual([200, 100]);
  });

  it('🔴 Κ3 κανένα EXIF στο παράγωγο', async () => {
    const tagged = await jpeg(400, 300, { exif: true });
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    const out = await encodeRasterDerivative(decodeOriented(tagged), { fit: 'width', px: 320 }, ENCODING, 4);
    expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
  });

  it('🔴 Κ4 η στροφή EXIF εφαρμόζεται (orientation 6 ⇒ πλάτος/ύψος αντιμετατίθενται)', async () => {
    const rotated = await jpeg(400, 200, { orientation: 6 });
    const out = await encodeRasterDerivative(decodeOriented(rotated), { fit: 'width', px: 2560 }, ENCODING, 4);
    expect([out.width, out.height]).toEqual([200, 400]);
  });

  it('σκουπίδια ⇒ πετά (ο καλών ονομάζει την αποτυχία)', async () => {
    await expect(
      encodeRasterDerivative(decodeOriented(Buffer.from('not an image')), { fit: 'width', px: 320 }, ENCODING, 4),
    ).rejects.toThrow();
  });
});
