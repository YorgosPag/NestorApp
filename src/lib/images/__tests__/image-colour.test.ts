/**
 * @jest-environment node
 *
 * @fileoverview **Χρώμα εικόνας + όνομα προφίλ ICC** (ADR-923 §5.10.3) — με **πραγματικά** προφίλ από το `sharp`
 * (`srgb` · `p3` · `cmyk`) και χειροποίητα/κακόβουλα bytes.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Χ1: το CMYK διαβάζεται ως RGB (λάθος απόφαση μετατροπής στην εκτύπωση).
 * - Χ2: η πυκνότητα-σκουπίδι (0 · NaN · 10⁶) περνά ως δήλωση.
 * - Χ3: το όνομα του προφίλ δεν διαβάζεται (v2 `desc` ή v4 `mluc`), ή διαβάζεται έξω από τα όρια του buffer.
 * - Χ4: η ισότητα χρώματος αγνοεί το προφίλ (αλλαγή P3 → sRGB δεν ξαναγράφεται).
 */

import sharp from 'sharp';

import { iccProfileName, ICC_PROFILE_NAME_MAX_LENGTH } from '../icc-profile-name';
import { imageColourOf, sameImageColour } from '../image-colour';

async function encodedWith(profile: 'srgb' | 'p3' | 'cmyk'): Promise<sharp.Metadata> {
  let pipeline = sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 30, b: 40 } } });
  if (profile === 'cmyk') pipeline = pipeline.toColourspace('cmyk');
  return sharp(await pipeline.withIccProfile(profile).jpeg().toBuffer()).metadata();
}

/** Ελάχιστο προφίλ: κεφαλίδα 128 · ένα tag `desc` · το σώμα του tag. */
function profileWithDesc(body: Uint8Array, declaredSize = body.byteLength): Uint8Array {
  const tagOffset = 128 + 4 + 12;
  const bytes = new Uint8Array(tagOffset + body.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(128, 1);
  bytes.set([0x64, 0x65, 0x73, 0x63], 132); // 'desc'
  view.setUint32(136, tagOffset);
  view.setUint32(140, declaredSize);
  bytes.set(body, tagOffset);
  return bytes;
}

function v2Desc(text: string): Uint8Array {
  const body = new Uint8Array(12 + text.length + 1);
  body.set([0x64, 0x65, 0x73, 0x63], 0);
  new DataView(body.buffer).setUint32(8, text.length + 1);
  for (let i = 0; i < text.length; i++) body[12 + i] = text.charCodeAt(i);
  return body;
}

function v4Mluc(records: ReadonlyArray<readonly [string, string]>): Uint8Array {
  const strings = records.map(([, text]) => text);
  const headerBytes = 16 + records.length * 12;
  const total = headerBytes + strings.reduce((sum, s) => sum + s.length * 2, 0);
  const body = new Uint8Array(total);
  const view = new DataView(body.buffer);
  body.set([0x6d, 0x6c, 0x75, 0x63], 0); // 'mluc'
  view.setUint32(8, records.length);
  view.setUint32(12, 12);
  let cursor = headerBytes;
  records.forEach(([locale, text], index) => {
    const record = 16 + index * 12;
    for (let i = 0; i < 4; i++) body[record + i] = locale.charCodeAt(i);
    view.setUint32(record + 4, text.length * 2);
    view.setUint32(record + 8, cursor);
    for (let i = 0; i < text.length; i++) view.setUint16(cursor + i * 2, text.charCodeAt(i));
    cursor += text.length * 2;
  });
  return body;
}

describe('iccProfileName — πραγματικά προφίλ', () => {
  it('🔴 Χ3 διαβάζει το όνομα των ενσωματωμένων προφίλ του sharp', async () => {
    const [srgb, p3, cmyk] = await Promise.all([encodedWith('srgb'), encodedWith('p3'), encodedWith('cmyk')]);
    expect(iccProfileName(srgb.icc as Uint8Array)).toMatch(/srgb/i);
    expect(iccProfileName(p3.icc as Uint8Array)).toMatch(/p3/i);
    expect(iccProfileName(cmyk.icc as Uint8Array)).toBe('Chemical proof');
  });
});

describe('iccProfileName — χειροποίητα και κακόβουλα bytes', () => {
  it('🔴 Χ3 v2 `desc` και v4 `mluc` (προτίμηση στα αγγλικά)', () => {
    expect(iccProfileName(profileWithDesc(v2Desc('Coated FOGRA39 (ISO 12647-2:2004)')))).toBe('Coated FOGRA39 (ISO 12647-2:2004)');
    const mluc = v4Mluc([['deDE', 'Gestrichen'], ['enUS', 'Coated FOGRA51']]);
    expect(iccProfileName(profileWithDesc(mluc))).toBe('Coated FOGRA51');
    expect(iccProfileName(profileWithDesc(v4Mluc([['elGR', 'Επιχρισμένο']])))).toBe('Επιχρισμένο');
  });

  it('🔴 Χ3 offsets εκτός buffer · τεράστιο πλήθος tags · άγνωστος τύπος ⇒ null, ποτέ εξαίρεση', () => {
    expect(iccProfileName(profileWithDesc(v2Desc('Name'), 10_000))).toBeNull();
    const hugeCount = new Uint8Array(200);
    new DataView(hugeCount.buffer).setUint32(128, 0xffffffff);
    expect(iccProfileName(hugeCount)).toBeNull();
    const lying = v2Desc('Name');
    new DataView(lying.buffer).setUint32(8, 5000);
    expect(iccProfileName(profileWithDesc(lying))).toBeNull();
    expect(iccProfileName(profileWithDesc(new Uint8Array([0x78, 0x78, 0x78, 0x78, 0, 0, 0, 0])))).toBeNull();
    expect(iccProfileName(new Uint8Array(0))).toBeNull();
  });

  it('χαρακτήρες ελέγχου αφαιρούνται · το μήκος κόβεται · κενό όνομα ⇒ null', () => {
    expect(iccProfileName(profileWithDesc(v2Desc('\u0007Bell\u0000')))).toBe('Bell');
    expect(iccProfileName(profileWithDesc(v2Desc('x'.repeat(500))))?.length).toBe(ICC_PROFILE_NAME_MAX_LENGTH);
    expect(iccProfileName(profileWithDesc(v2Desc('   ')))).toBeNull();
  });
});

describe('imageColourOf', () => {
  it('🔴 Χ1 CMYK από πραγματικό αρχείο ⇒ model cmyk, 4 κανάλια, με όνομα προφίλ', async () => {
    const colour = imageColourOf(await encodedWith('cmyk'));
    expect(colour).toMatchObject({ model: 'cmyk', channels: 4, hasAlpha: false, bitsPerSample: 8, profile: { name: 'Chemical proof' } });
  });

  it('χωρίς προφίλ ⇒ `profile: null` · 16-bit ⇒ 16 · διάφανο ⇒ hasAlpha · άγνωστος χώρος ⇒ other', () => {
    expect(imageColourOf({ space: 'srgb', channels: 3, depth: 'uchar' })?.profile).toBeNull();
    expect(imageColourOf({ space: 'rgb16', channels: 3, depth: 'ushort' })).toMatchObject({ model: 'rgb', bitsPerSample: 16 });
    expect(imageColourOf({ space: 'srgb', channels: 4, hasAlpha: true })?.hasAlpha).toBe(true);
    expect(imageColourOf({ space: 'b-w', channels: 1 })?.model).toBe('grey');
    expect(imageColourOf({ space: 'multiband', channels: 7 })?.model).toBe('other');
    expect(imageColourOf({ space: 'srgb', channels: 3, hasProfile: true })?.profile).toEqual({ name: null });
  });

  it('🔴 Χ2 πυκνότητα-σκουπίδι ⇒ null · έγκυρη ⇒ στρογγυλεμένη σε ppi', () => {
    for (const density of [0, -1, Number.NaN, 1_000_000]) {
      expect(imageColourOf({ space: 'srgb', channels: 3, density })?.density).toBeNull();
    }
    expect(imageColourOf({ space: 'srgb', channels: 3, density: 299.9994 })?.density).toBe(300);
  });

  it('κομμένη κεφαλίδα (χωρίς χώρο ή κανάλια) ⇒ null', () => {
    expect(imageColourOf({})).toBeNull();
    expect(imageColourOf({ space: 'srgb' })).toBeNull();
  });
});

describe('sameImageColour', () => {
  const base = { model: 'rgb', channels: 3, hasAlpha: false, bitsPerSample: 8, density: 300, profile: { name: 'Display P3' } } as const;

  it('🔴 Χ4 κάθε πεδίο μετρά — και το προφίλ, και η απουσία του', () => {
    expect(sameImageColour(base, { ...base })).toBe(true);
    expect(sameImageColour(base, { ...base, profile: { name: 'sRGB' } })).toBe(false);
    expect(sameImageColour(base, { ...base, profile: null })).toBe(false);
    expect(sameImageColour({ ...base, profile: null }, { ...base, profile: { name: null } })).toBe(false);
    expect(sameImageColour(base, { ...base, density: 72 })).toBe(false);
    expect(sameImageColour(base, { ...base, model: 'cmyk' })).toBe(false);
    expect(sameImageColour(base, null)).toBe(false);
  });
});
