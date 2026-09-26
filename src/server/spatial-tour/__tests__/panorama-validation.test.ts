/**
 * @jest-environment node
 *
 * @fileoverview **Η ΕΠΙΚΥΡΩΣΗ ΠΑΝΟΡΑΜΑΤΟΣ** (ADR-884 Φ0.8 · Κ3α) — πάνω σε **πραγματικά** bytes, όχι σε δηλώσεις.
 *
 * - **Κ** η κρίση (`judgePanorama`) — καθαρή· κάθε άρνηση αλλάζει **ένα** γεγονός.
 * - **Ε** η εξαγωγή (`readPanoramaFacts`) από JPEG/PNG που φτιάχνει το `sharp` εδώ — με και χωρίς XMP GPano.
 * - **Δ** η δήλωση πριν ανοίξει συνεδρία.
 */

jest.mock('server-only', () => ({}));

import sharp from 'sharp';

import {
  PANORAMA_MAX_BYTES,
  judgePanorama,
  refusalOfDeclaredPanorama,
  type PanoramaFacts,
} from '@/lib/spatial-tour/panorama-policy';

import { readPanoramaFacts } from '../panorama-facts';

const GOOD: PanoramaFacts = {
  format: 'jpeg', widthPx: 8192, heightPx: 4096, byteLength: 15_000_000, projectionType: null, poseHeadingDegrees: null,
  takenAt: null,
};

const gpanoXmp = (projection: string, heading: number) => `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"
 GPano:ProjectionType="${projection}" GPano:PoseHeadingDegrees="${heading}"/>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } } });

describe('Κ — η κρίση', () => {
  it('✅ 8192×4096 JPEG χωρίς XMP ⇒ δεκτό, κατεύθυνση 0· με ±1px στρογγύλεμα ⇒ δεκτό', () => {
    expect(judgePanorama(GOOD)).toEqual({ ok: true, headingRad: 0 });
    expect(judgePanorama({ ...GOOD, heightPx: 4097 }).ok).toBe(true);
  });

  it.each([
    ['PNG', { format: 'png' }, 'not-jpeg'],
    ['πάνω από 40 MB', { byteLength: PANORAMA_MAX_BYTES + 1 }, 'too-large'],
    ['4:3 (επίπεδη φωτογραφία)', { widthPx: 4096, heightPx: 3072 }, 'not-equirect'],
    ['χωρίς διαστάσεις', { widthPx: null }, 'not-equirect'],
    ['2:1 αλλά 2K', { widthPx: 2048, heightPx: 1024 }, 'too-small'],
    ['XMP κυλινδρική', { projectionType: 'cylindrical' }, 'wrong-projection'],
  ] as const)('🔴 %s ⇒ `%s`', (_label, patch, refusal) => {
    expect(judgePanorama({ ...GOOD, ...patch })).toEqual({ ok: false, refusal });
  });

  it('🧭 κατεύθυνση από GPano σε ακτίνια, ΑΥΤΟΥΣΙΑ (η περιτύλιξη είναι του θεατή — ένα SSoT)', () => {
    const heading = (deg: number) => {
      const verdict = judgePanorama({ ...GOOD, projectionType: 'equirectangular', poseHeadingDegrees: deg });
      return verdict.ok ? verdict.headingRad : Number.NaN;
    };
    expect(heading(90)).toBeCloseTo(Math.PI / 2);
    expect(heading(-90)).toBeCloseTo(-Math.PI / 2);
    expect(heading(450)).toBeCloseTo((5 * Math.PI) / 2);
  });
});

describe('Ε — η εξαγωγή από πραγματικά bytes', () => {
  it('✅ JPEG 4096×2048 με XMP GPano ⇒ γεγονότα, και η κρίση το δέχεται με κατεύθυνση', async () => {
    const bytes = await image(4096, 2048).withXmp(gpanoXmp('equirectangular', 180)).jpeg().toBuffer();
    const facts = await readPanoramaFacts(bytes);
    expect(facts).toMatchObject({ format: 'jpeg', widthPx: 4096, heightPx: 2048, projectionType: 'equirectangular', poseHeadingDegrees: 180 });
    expect(judgePanorama(facts)).toEqual({ ok: true, headingRad: expect.closeTo(Math.PI) });
  });

  it('🕰️ EXIF DateTimeOriginal ⇒ `takenAt` (πότε τραβήχτηκε, όχι πότε ανέβηκε)· χωρίς EXIF ⇒ null', async () => {
    const withExif = await image(4096, 2048).withExif({ IFD2: { DateTimeOriginal: '2026:08:14 10:30:00' } }).jpeg().toBuffer();
    expect((await readPanoramaFacts(withExif)).takenAt).toMatch(/^2026-08-14T/);
    const bare = await image(4096, 2048).jpeg().toBuffer();
    expect((await readPanoramaFacts(bare)).takenAt).toBeNull();
  });

  it('🔴 PNG 2:1 ⇒ `not-jpeg` (ο τύπος από τα bytes, όχι από τη δήλωση)', async () => {
    const bytes = await image(4096, 2048).png().toBuffer();
    expect(judgePanorama(await readPanoramaFacts(bytes))).toEqual({ ok: false, refusal: 'not-jpeg' });
  });

  it('🔴 JPEG 4:3 ⇒ `not-equirect`· σκουπίδια ⇒ `not-jpeg` χωρίς εξαίρεση', async () => {
    const flat = await image(4096, 3072).jpeg().toBuffer();
    expect(judgePanorama(await readPanoramaFacts(flat))).toEqual({ ok: false, refusal: 'not-equirect' });
    const junk = Buffer.from('αυτό δεν είναι εικόνα');
    expect(judgePanorama(await readPanoramaFacts(junk))).toEqual({ ok: false, refusal: 'not-jpeg' });
  });
});

describe('Δ — η δήλωση πριν ανοίξει συνεδρία', () => {
  it('δεκτό JPEG ≤ 40 MB · άρνηση άλλου τύπου · άρνηση υπέρβασης', () => {
    expect(refusalOfDeclaredPanorama({ contentType: 'image/jpeg', byteLength: 15_000_000 })).toBeNull();
    expect(refusalOfDeclaredPanorama({ contentType: 'image/png', byteLength: 10 })).toBe('not-jpeg');
    expect(refusalOfDeclaredPanorama({ contentType: 'image/jpeg', byteLength: PANORAMA_MAX_BYTES + 1 })).toBe('too-large');
  });
});
