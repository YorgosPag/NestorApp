/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΣΥΓΚΛΙΣΗΣ** — ό,τι ανέβηκε με παλιά κρυφή μνήμη φτάνει στη δηλωμένη.
 * @related ADR-845 §7.17 Α7 · public-shelf-bucket.ts (`convergeShelfCacheControl`)
 *
 * 🔴 **Τι ρωτά που καμία άλλη σουίτα δεν ρωτά**: οι υπόλοιπες ελέγχουν τι γράφεται **την ώρα του
 * ανεβάσματος**. Το `cacheControl` όμως είναι μεταδεδομένο **ανά αντικείμενο**, και το ράφι δεν
 * ξαναγράφει ό,τι υπάρχει ήδη — άρα μια αλλαγή της σταθεράς, χωρίς αυτό το πέρασμα, αφήνει κάθε
 * ήδη δημόσιο αντικείμενο στην παλιά καθυστέρηση απόσυρσης **για πάντα**, με όλες τις άγκυρες πράσινες.
 */

import {
  PUBLIC_SHELF_CACHE_CONTROL,
  shelfCacheControlFor,
} from '@/services/upload/utils/storage-path-public-shelf';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';

const shelf = new FakeShelfBucket();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { convergeShelfCacheControl, staleCacheControl } = require('../public-shelf-bucket') as
  typeof import('../public-shelf-bucket');

const HASH = 'a'.repeat(64);
const OLD = 'public, max-age=3600, immutable';
const OLD_VIDEO = `${OLD}, no-transform`;

const PHOTO = `listings/prop_1/${HASH}.webp`;
const MODEL = `listings/prop_1/${HASH}.glb`;
const VIDEO = `listings/prop_1/${HASH}.mp4`;
const FOREIGN = `listings/prop_1/${HASH}.svg`;

async function given(key: string, cacheControl: string | undefined): Promise<void> {
  await shelf.file(key).save(Buffer.from(key), { metadata: { cacheControl } });
}

function cacheOf(key: string): string | undefined {
  return shelf.objects.get(key)?.cacheControl;
}

beforeEach(() => {
  shelf.reset();
});

describe('Σ1 — τι κρυφή μνήμη ΛΕΙΠΕΙ (καθαρή κρίση)', () => {
  it('ό,τι συμφωνεί ήδη δεν θέλει τίποτα', () => {
    expect(staleCacheControl(PHOTO, PUBLIC_SHELF_CACHE_CONTROL)).toBeNull();
    expect(staleCacheControl(VIDEO, shelfCacheControlFor('mp4'))).toBeNull();
  });

  it('παλιά τιμή ⇒ η δηλωμένη της ΜΟΡΦΗΣ του', () => {
    expect(staleCacheControl(PHOTO, OLD)).toBe(PUBLIC_SHELF_CACHE_CONTROL);
    expect(staleCacheControl(MODEL, OLD)).toBe(PUBLIC_SHELF_CACHE_CONTROL);
    expect(staleCacheControl(VIDEO, OLD_VIDEO)).toBe(shelfCacheControlFor('mp4'));
  });

  it('αντικείμενο ΧΩΡΙΣ κρυφή μνήμη τη δέχεται — η απουσία δεν είναι συμφωνία', () => {
    expect(staleCacheControl(PHOTO, undefined)).toBe(PUBLIC_SHELF_CACHE_CONTROL);
  });

  it('🔴 άγνωστη κατάληξη ⇒ δεν αγγίζεται, ό,τι κι αν λέει', () => {
    expect(staleCacheControl(FOREIGN, OLD)).toBeNull();
    expect(staleCacheControl('README', undefined)).toBeNull();
  });
});

describe('Σ2 — το πέρασμα πάνω στον κάδο', () => {
  it('διορθώνει ό,τι αποκλίνει και αφήνει ό,τι συμφωνεί', async () => {
    await given(PHOTO, OLD);
    await given(MODEL, PUBLIC_SHELF_CACHE_CONTROL);

    const report = await convergeShelfCacheControl();

    expect(report).toEqual({ scanned: 2, healed: 1 });
    expect(cacheOf(PHOTO)).toBe(PUBLIC_SHELF_CACHE_CONTROL);
    expect(shelf.metadataCalls).toBe(1);
  });

  it('🔴 το βίντεο κρατά το `no-transform` — η «διόρθωση» δεν το σβήνει', async () => {
    await given(VIDEO, OLD_VIDEO);

    await convergeShelfCacheControl();

    expect(cacheOf(VIDEO)).toMatch(/(^|,\s*)no-transform(\s*,|$)/);
    expect(cacheOf(VIDEO)).toContain('max-age=300');
  });

  it('άγνωστη κατάληξη μένει όπως βρέθηκε', async () => {
    await given(FOREIGN, OLD);

    const report = await convergeShelfCacheControl();

    expect(report.healed).toBe(0);
    expect(cacheOf(FOREIGN)).toBe(OLD);
  });

  it('🔑 ιδεμποτές — δεύτερο πέρασμα δεν γράφει τίποτα', async () => {
    await given(PHOTO, OLD);
    await given(VIDEO, OLD_VIDEO);
    await convergeShelfCacheControl();
    const writesAfterFirst = shelf.metadataCalls;

    const second = await convergeShelfCacheControl();

    expect(second).toEqual({ scanned: 2, healed: 0 });
    expect(shelf.metadataCalls).toBe(writesAfterFirst);
  });

  it('αγγίζει ΜΟΝΟ μεταδεδομένα — ούτε bytes, ούτε διαγραφή, ούτε τα προσαρμοσμένα κλειδιά', async () => {
    await shelf.file(PHOTO).save(Buffer.from('bytes'), {
      metadata: { cacheControl: OLD, metadata: { sourceRef: 'x' } },
    });
    const before = shelf.objects.get(PHOTO);
    const savesBefore = shelf.saveCalls;

    await convergeShelfCacheControl();

    const after = shelf.objects.get(PHOTO);
    expect(after?.bytes).toBe(before?.bytes);
    expect(after?.generation).toBe(before?.generation);
    expect(after?.custom).toEqual({ sourceRef: 'x' });
    expect(shelf.saveCalls).toBe(savesBefore);
    expect(shelf.deleteCalls).toBe(0);
  });

  it('πολλά αντικείμενα — περνούν όλα, σε δέσμες', async () => {
    const keys = Array.from({ length: 60 }, (_, index) =>
      `listings/prop_${index}/${HASH}.webp`);
    for (const key of keys) await given(key, OLD);

    const report = await convergeShelfCacheControl();

    expect(report).toEqual({ scanned: 60, healed: 60 });
    expect(keys.every((key) => cacheOf(key) === PUBLIC_SHELF_CACHE_CONTROL)).toBe(true);
  });
});
