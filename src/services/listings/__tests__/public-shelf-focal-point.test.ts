/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΚΙΝΗΤΗΡΑ ΕΣΤΙΑΣΗΣ** — πραγματικό `sharp`, συνθετικές εικόνες (ADR-880).
 * @related public-shelf-focal-point.ts
 *
 * 🔴 Κάθε περίπτωση εδώ είναι **μετρημένη παγίδα**, όχι φανταστική: το JPEG έδινε συντεταγμένες σε
 * άλλο σύστημα από το PNG, η επίπεδη εικόνα έδινε `(0,0)`, και η εικόνα που δεν χρειάζεται περικοπή
 * δεν έδινε τίποτα. Το θέμα είναι ένα κορεσμένο, «δερματικό» τετράγωνο σε γκρι φόντο — ακριβώς αυτό
 * που ψάχνει η στρατηγική `attention` — σε **γνωστή** θέση.
 */

import sharp from 'sharp';

import { detectFocalPoint, detectFocalPointInBytes } from '../public-shelf-focal-point';

type Format = 'png' | 'jpeg';

async function subjectAt(
  width: number,
  height: number,
  cx: number,
  cy: number,
  format: Format,
): Promise<Buffer> {
  const side = Math.round(Math.min(width, height) * 0.12);
  const blob = await sharp({
    create: { width: side, height: side, channels: 3, background: { r: 230, g: 160, b: 130 } },
  }).png().toBuffer();
  const canvas = sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  }).composite([{ input: blob, left: Math.round(cx * width - side / 2), top: Math.round(cy * height - side / 2) }]);
  return format === 'png' ? canvas.png().toBuffer() : canvas.jpeg({ quality: 90 }).toBuffer();
}

const TOLERANCE = 0.06;

function expectNear(point: { x: number; y: number } | null, x: number, y: number): void {
  expect(point).not.toBeNull();
  expect(Math.abs((point?.x ?? -1) - x)).toBeLessThan(TOLERANCE);
  expect(Math.abs((point?.y ?? -1) - y)).toBeLessThan(TOLERANCE);
}

describe('detectFocalPointInBytes — το θέμα βρίσκεται εκεί που είναι', () => {
  it.each<[string, number, number, number, number]>([
    ['κάθετη κινητού 2:3', 1000, 1500, 0.7, 0.2],
    ['τετράγωνη (καμία «φυσική» περικοπή)', 1200, 1200, 0.3, 0.8],
    ['οριζόντια 3:2', 3000, 2000, 0.85, 0.5],
  ])('%s', async (_label, w, h, x, y) => {
    expectNear(await detectFocalPointInBytes(await subjectAt(w, h, x, y, 'png')), x, y);
  });

  it('🔴 παγίδα 1: JPEG δίνει το ΙΔΙΟ σημείο με PNG (shrink-on-load)', async () => {
    const [png, jpeg] = await Promise.all([
      detectFocalPointInBytes(await subjectAt(2400, 1200, 0.8, 0.6, 'png')),
      detectFocalPointInBytes(await subjectAt(2400, 1200, 0.8, 0.6, 'jpeg')),
    ]);
    expectNear(png, 0.8, 0.6);
    expectNear(jpeg, 0.8, 0.6);
  });

  it('🔴 παγίδα 2: επίπεδη εικόνα ⇒ null, ΟΧΙ η πάνω-αριστερή γωνία', async () => {
    const flat = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#808080' },
    }).jpeg().toBuffer();
    expect(await detectFocalPointInBytes(flat)).toBeNull();
  });

  it('στρέφει κατά EXIF: κάθετη φωτογραφία αποθηκευμένη πλάγια', async () => {
    // Θέμα στο (0.2, 0.3) της ΟΡΘΙΑΣ εικόνας 1000×1500· αποθηκεύεται γυρισμένη 90° δεξιόστροφα
    // με σημαία orientation=6 ⇒ ο αναγνώστης οφείλει να τη γυρίσει πίσω.
    const upright = await subjectAt(1000, 1500, 0.2, 0.3, 'png');
    const sideways = await sharp(upright).rotate(-90).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expectNear(await detectFocalPointInBytes(sideways), 0.2, 0.3);
  });

  it('ποτέ δεν πετά: σκουπίδι και κενά bytes ⇒ null', async () => {
    expect(await detectFocalPointInBytes(Buffer.from('not an image'))).toBeNull();
    expect(await detectFocalPointInBytes(Buffer.alloc(0))).toBeNull();
  });

  it('μικροσκοπική εικόνα ⇒ null (κανένα περιθώριο περικοπής)', async () => {
    const tiny = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff0000' } }).png().toBuffer();
    expect(await detectFocalPointInBytes(tiny)).toBeNull();
  });
});

describe('detectFocalPoint — πάνω στον ΙΔΙΟ αγωγό του καθαριστή', () => {
  it('δεν καταναλώνει τον αγωγό: ο καλών μπορεί να κωδικοποιήσει μετά', async () => {
    const pipeline = sharp(await subjectAt(1000, 1500, 0.5, 0.25, 'png')).rotate();
    expectNear(await detectFocalPoint(pipeline), 0.5, 0.25);
    const { info } = await pipeline.clone().webp().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1000);
  });

  it('εικόνα με κανάλι alpha (16-bit PNG)', async () => {
    const rgba16 = await sharp(await subjectAt(1200, 800, 0.25, 0.5, 'png'))
      .ensureAlpha()
      .png({ bitdepth: 16 } as sharp.PngOptions)
      .toBuffer();
    expectNear(await detectFocalPointInBytes(rgba16), 0.25, 0.5);
  });
});
