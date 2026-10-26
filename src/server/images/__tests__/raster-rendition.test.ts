/**
 * @jest-environment node
 *
 * @fileoverview **Αποδόσεις JPEG/PNG με απόφαση χρώματος** (ADR-923 §5.10.3) — πραγματικό `sharp`, πραγματικά προφίλ
 * (`cmyk` · `p3` · `srgb`), πραγματικό CMYK. Η **πρώτη** άγκυρα CMYK/ICC του αποθετηρίου.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ρ1: η εκτύπωση χάνει το CMYK (το `keepIccProfile` μόνο του μετατρέπει σε sRGB — μετρημένο).
 * - Ρ2: η εκτύπωση χάνει το προφίλ RGB της πηγής (P3 ⇒ sRGB).
 * - Ρ3: το web δεν μετατρέπει CMYK σε sRGB (ή μετατρέπει χωρίς το προφίλ της πηγής ⇒ λάθος χρώμα).
 * - Ρ4: πηγή χωρίς προφίλ βγαίνει χωρίς προφίλ / χωρίς δήλωση υπόθεσης.
 * - Ρ5: η διαφάνεια χάνεται (JPEG) ή το EXIF/GPS διαρρέει ή ο προσανατολισμός χάνεται.
 */

jest.mock('server-only', () => ({}));

import sharp from 'sharp';

import { imageColourOf, type ImageColour } from '@/lib/images/image-colour';
import { decodeOriented, encodeRasterRendition, type RasterRenditionSpec } from '../raster-encoder';

const WEB: RasterRenditionSpec = { box: { fit: 'max-edge', px: 2048 }, colour: 'srgb', jpegQuality: 82, chromaSubsampling: '4:2:0' };
const PRINT: RasterRenditionSpec = { box: { fit: 'max-edge', px: 12000 }, colour: 'preserve', jpegQuality: 95, chromaSubsampling: '4:4:4' };
const RED = { r: 200, g: 30, b: 40 };

function rgbCanvas(width = 300, height = 200, channels: 3 | 4 = 3): sharp.Sharp {
  const background = channels === 4 ? { ...RED, alpha: 0.4 } : RED;
  return sharp({ create: { width, height, channels, background } });
}

async function sourceColour(bytes: Buffer): Promise<ImageColour> {
  const colour = imageColourOf(await sharp(bytes).metadata());
  if (colour === null) throw new Error('no colour');
  return colour;
}

async function render(bytes: Buffer, spec: RasterRenditionSpec) {
  return encodeRasterRendition(decodeOriented(bytes), await sourceColour(bytes), spec);
}

/** Το μέσο χρώμα της απόδοσης, σε sRGB (ό,τι θα δείξει ένας θεατής με διαχείριση χρώματος). */
async function meanSrgb(bytes: Buffer): Promise<readonly number[]> {
  return [...(await sharp(bytes).toColourspace('srgb').resize(1, 1).removeAlpha().raw().toBuffer())];
}

describe('encodeRasterRendition — εκτύπωση (late binding)', () => {
  it('🔴 Ρ1 CMYK με προφίλ ⇒ μένει CMYK, με ΤΟ ΙΔΙΟ προφίλ', async () => {
    const cmyk = await rgbCanvas().toColourspace('cmyk').withIccProfile('cmyk').jpeg().toBuffer();
    const out = await render(cmyk, PRINT);
    expect(out.contentType).toBe('image/jpeg');
    expect(out.colour).toMatchObject({ model: 'cmyk', channels: 4, profile: { name: 'Chemical proof' } });
    expect(out).toMatchObject({ colourPreserved: true, assumedProfile: false });
  });

  it('🔴 Ρ2 RGB με προφίλ P3 ⇒ κρατά το P3 (όχι σιωπηλά sRGB)', async () => {
    const p3 = await rgbCanvas().withIccProfile('p3').jpeg().toBuffer();
    const out = await render(p3, PRINT);
    expect(out.colour.model).toBe('rgb');
    expect(out.colour.profile?.name).toMatch(/p3/i);
    expect(out.colourPreserved).toBe(true);
  });

  it('🔴 Ρ4 RGB χωρίς προφίλ ⇒ σημαίνεται sRGB, ΔΗΛΩΜΕΝΑ ως υπόθεση', async () => {
    const untagged = await rgbCanvas().jpeg().toBuffer();
    expect((await sharp(untagged).metadata()).hasProfile).toBe(false);
    const out = await render(untagged, PRINT);
    expect(out.colour.profile?.name).toMatch(/srgb/i);
    expect(out.assumedProfile).toBe(true);
  });

  it('16-bit πηγή ⇒ 8-bit απόδοση · γκρι ⇒ μένει γκρι', async () => {
    const deep = await rgbCanvas().toColourspace('rgb16').png().toBuffer();
    expect((await render(deep, PRINT)).colour.bitsPerSample).toBe(8);
    const grey = await rgbCanvas().toColourspace('b-w').jpeg().toBuffer();
    expect((await render(grey, PRINT)).colour.model).toBe('grey');
  });

  it('πλήρης ανάλυση ως το όριο της συνταγής — ποτέ μεγέθυνση', async () => {
    const out = await render(await rgbCanvas(3000, 1000).jpeg().toBuffer(), PRINT);
    expect([out.width, out.height]).toEqual([3000, 1000]);
  });
});

describe('encodeRasterRendition — web', () => {
  it('🔴 Ρ3 CMYK ⇒ sRGB με προφίλ sRGB, και ΤΟ ΧΡΩΜΑ ΜΕΝΕΙ (μέσα σε ανοχή διαχείρισης χρώματος)', async () => {
    const cmyk = await rgbCanvas().toColourspace('cmyk').withIccProfile('cmyk').jpeg().toBuffer();
    const out = await render(cmyk, WEB);
    expect(out.colour).toMatchObject({ model: 'rgb', channels: 3 });
    expect(out.colour.profile?.name).toMatch(/srgb/i);
    expect(out.colourPreserved).toBe(false);
    const [r, g, b] = await meanSrgb(out.bytes);
    for (const [channel, expected] of [[r, RED.r], [g, RED.g], [b, RED.b]]) expect(Math.abs(channel - expected)).toBeLessThanOrEqual(12);
  });

  it('🔴 Ρ3 P3 ⇒ sRGB (το web δεν παραδίδει ευρύ χρωματικό χώρο)', async () => {
    const out = await render(await rgbCanvas().withIccProfile('p3').jpeg().toBuffer(), WEB);
    expect(out.colour.profile?.name).toMatch(/srgb/i);
  });

  it('μέγιστη πλευρά 2048', async () => {
    const out = await render(await rgbCanvas(5000, 2500).jpeg().toBuffer(), WEB);
    expect([out.width, out.height]).toEqual([2048, 1024]);
  });
});

describe('encodeRasterRendition — διαφάνεια, μεταδεδομένα, προσανατολισμός', () => {
  it('🔴 Ρ5 διάφανη πηγή ⇒ PNG με κανάλι alpha (web ΚΑΙ εκτύπωση)', async () => {
    const cutout = await rgbCanvas(300, 200, 4).png().toBuffer();
    for (const spec of [WEB, PRINT]) {
      const out = await render(cutout, spec);
      expect(out.contentType).toBe('image/png');
      expect(out.colour.hasAlpha).toBe(true);
      expect((await sharp(out.bytes).metadata()).format).toBe('png');
    }
  });

  it('🔴 Ρ5 κανένα EXIF/GPS στην απόδοση, και ο προσανατολισμός εφαρμόζεται', async () => {
    const tagged = await rgbCanvas(400, 200).jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'nestor-test' }, GPS: { GPSLatitudeRef: 'N' } } })
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    for (const spec of [WEB, PRINT]) {
      const out = await render(tagged, spec);
      expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
      expect([out.width, out.height]).toEqual([200, 400]);
    }
  });

  it('σκουπίδια ⇒ πετά (ο καλών ονομάζει την αποτυχία)', async () => {
    const colour: ImageColour = { model: 'rgb', channels: 3, hasAlpha: false, bitsPerSample: 8, density: null, profile: null };
    await expect(encodeRasterRendition(decodeOriented(Buffer.from('not an image')), colour, WEB)).rejects.toThrow();
  });
});
