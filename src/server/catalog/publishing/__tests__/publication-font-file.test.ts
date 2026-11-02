/**
 * ADR-923 §5.6.1 — τα γεγονότα βγαίνουν από τα bytes. Πραγματικό TTF του έργου, με το `fsType` πειραγμένο μέσα στο αρχείο,
 * γιατί αυτό θα έκανε ένας προμηθευτής που ανεβάζει γραμματοσειρά με περιορισμένη άδεια.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { inspectFontFile } from '../publication-font-file.server';

jest.mock('server-only', () => ({}));
jest.mock('../typst-engine.server', () => ({ readTypstFontFamily: jest.fn() }));

const OS2_FS_TYPE_OFFSET = 8;
const LIBERATION = readFileSync(path.join(process.cwd(), 'public/fonts/LiberationSans-Regular.ttf'));
const readFamily = jest.fn(async () => 'Liberation Sans');

/** Το `OS/2` από τον κατάλογο πινάκων του sfnt: 12 bytes κεφαλίδα, 16 bytes ανά πίνακα. */
function os2OffsetOf(bytes: Buffer): number {
  const tables = bytes.readUInt16BE(4);
  for (let index = 0; index < tables; index += 1) {
    const entry = 12 + index * 16;
    if (bytes.toString('latin1', entry, entry + 4) === 'OS/2') return bytes.readUInt32BE(entry + 8);
  }
  throw new Error('OS/2 missing');
}

function withFsType(fsType: number): Buffer {
  const bytes = Buffer.from(LIBERATION);
  bytes.writeUInt16BE(fsType, os2OffsetOf(bytes) + OS2_FS_TYPE_OFFSET);
  return bytes;
}

describe('inspectFontFile', () => {
  beforeEach(() => readFamily.mockClear());

  it('🔑 πραγματικό TTF: όνομα από τη μηχανή, γεγονότα από το αρχείο', async () => {
    const result = await inspectFontFile(LIBERATION, readFamily);
    expect(result).toMatchObject({ kind: 'ready', facts: { family: 'Liberation Sans', weight: 400, italic: false, embedding: 'installable', coversLatin: true, coversGreek: true } });
    if (result.kind !== 'ready') throw new Error('refused');
    expect(result.facts.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.facts.copyright).toContain('Red Hat');
  });

  it('🔴 Restricted μέσα στα bytes αρνείται, χωρίς να ρωτηθεί η μηχανή', async () => {
    await expect(inspectFontFile(withFsType(0x0002), readFamily)).resolves.toEqual({ kind: 'refused', code: 'fontEmbeddingForbidden' });
    expect(readFamily).not.toHaveBeenCalled();
  });

  it('🔴 αρχείο που δεν είναι γραμματοσειρά αρνείται, δεν ρίχνει τον διακομιστή', async () => {
    await expect(inspectFontFile(new Uint8Array([1, 2, 3, 4]), readFamily)).resolves.toEqual({ kind: 'refused', code: 'fontFileUnreadable' });
  });

  it('🔴 η μηχανή δεν το βλέπει: άρνηση, ποτέ σιωπηλά άλλη γραμματοσειρά', async () => {
    await expect(inspectFontFile(LIBERATION, jest.fn(async () => null))).resolves.toEqual({ kind: 'refused', code: 'fontFileUnreadable' });
  });
});
