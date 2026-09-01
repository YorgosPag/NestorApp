/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΕΠΙΛΟΓΗΣ** — τι φεύγει στον κόσμο, και τι ΔΕΝ φεύγει.
 * @related ADR-841 §7 (Α2.1 · Α2.7 · Α12.10) · lib/owner-property/owner-media-publication
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Μπορεί ένα αρχείο να βγει στον κόσμο χωρίς ο άνθρωπος να το έχει πει;**
 *
 * Η Φ2 κράτησε το ράφι **άδειο** ακριβώς επειδή δεν υπήρχε απάντηση σε αυτό (Α12.10):
 * αυτόματη δημοσίευση **όλων** θα έβγαζε και την ταυτότητα που ανέβηκε **κατά λάθος**.
 * Η μετάλλαξη που πρέπει να κοκκινίσει είναι **μία γραμμή**: `filter(published)` →
 * `map(everything)`.
 *
 * 🔑 **Και η δεύτερη ερώτηση είναι Η ΣΕΙΡΑ.** Η Α6.2 απέρριψε ρητά τον χρόνο ως
 * κριτήριο σειράς. Αν κάποιος βάλει εδώ ένα `sort((a,b) => a.uploadedAt < b.uploadedAt)`,
 * η οθόνη θα δείχνει «πρώτη» άλλη φωτογραφία από αυτήν που διάλεξε ο άνθρωπος.
 */

import {
  PUBLISHED_MEDIA_LIMIT,
  isLeadOwnerMedia,
  publishedOwnerMedia,
  publishedOwnerMediaSources,
  withOwnerMediaFirst,
} from '@/lib/owner-property/owner-media-publication';
import type { OwnerPropertyMedia } from '@/types/owner-property';

function media(
  name: string,
  published: boolean | undefined,
  uploadedAt = '2026-01-01T00:00:00.000Z',
): OwnerPropertyMedia {
  return {
    storagePath: `owner_properties/u1/ownp_1/${name}`,
    fileName: name,
    sizeBytes: 1024,
    uploadedAt,
    ...(published === undefined ? {} : { published }),
  };
}

describe('Ε1 — OPT-IN: ό,τι δεν επιλέχθηκε ΔΕΝ φεύγει', () => {
  it('αρχείο χωρίς σημαία μένει ιδιωτικό', () => {
    expect(publishedOwnerMediaSources([media('a.jpg', undefined)])).toEqual([]);
  });

  it('αρχείο με ρητό `false` μένει ιδιωτικό', () => {
    expect(publishedOwnerMediaSources([media('a.jpg', false)])).toEqual([]);
  });

  it('🔴 μόνο τα ρητά επιλεγμένα φτάνουν στο ράφι', () => {
    const sources = publishedOwnerMediaSources([
      media('private.jpg', false),
      media('public.jpg', true),
      media('untouched.jpg', undefined),
    ]);

    expect(sources).toEqual([
      { privateStoragePath: 'owner_properties/u1/ownp_1/public.jpg' },
    ]);
  });

  it('κανένα επιλεγμένο ⇒ ΚΕΝΟ σύνολο ⇒ το ράφι αδειάζει', () => {
    expect(publishedOwnerMediaSources([media('a.jpg', false), media('b.jpg', false)])).toEqual([]);
  });
});

describe('Ε2 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟΥ ΑΝΘΡΩΠΟΥ, ΟΧΙ ΤΟΥ ΡΟΛΟΓΙΟΥ', () => {
  it('🔴 η σειρά είναι η σειρά ΤΟΥ ΠΙΝΑΚΑ, ακόμη κι όταν ο χρόνος λέει το αντίθετο', () => {
    // Το `b` ανέβηκε **πρώτο** χρονικά αλλά ο κάτοχος το έβαλε **δεύτερο**.
    const list = [
      media('a.jpg', true, '2026-05-05T00:00:00.000Z'),
      media('b.jpg', true, '2026-01-01T00:00:00.000Z'),
    ];

    expect(publishedOwnerMedia(list).map((item) => item.fileName)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('«πρώτη» σημαίνει πρώτη ΑΠΟ ΟΣΕΣ ΔΗΜΟΣΙΕΥΟΝΤΑΙ, όχι πρώτη του πίνακα', () => {
    const list = [media('idiotiki.jpg', false), media('dimosia.jpg', true)];

    expect(isLeadOwnerMedia(list, list[0].storagePath)).toBe(false);
    expect(isLeadOwnerMedia(list, list[1].storagePath)).toBe(true);
  });

  it('«να μπει πρώτη» μετακινεί ΜΕΣΑ στον ίδιο πίνακα — κανένα πεδίο σειράς', () => {
    const list = [media('a.jpg', true), media('b.jpg', true), media('c.jpg', true)];

    const moved = withOwnerMediaFirst(list, list[2].storagePath);

    expect(moved.map((item) => item.fileName)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    expect(moved).toHaveLength(list.length);
    expect(isLeadOwnerMedia(moved, list[2].storagePath)).toBe(true);
  });

  it('άγνωστο μονοπάτι ⇒ ο πίνακας μένει ΑΜΕΤΑΒΛΗΤΟΣ', () => {
    const list = [media('a.jpg', true)];
    expect(withOwnerMediaFirst(list, 'pouthena')).toBe(list);
  });
});

describe('Ε3 — ΤΟ ΟΡΙΟ: η οθόνη και ο κόσμος ΔΕΝ μπορούν να διαφωνήσουν', () => {
  it('κόβει στο δηλωμένο όριο, κρατώντας τις πρώτες', () => {
    const list = Array.from({ length: PUBLISHED_MEDIA_LIMIT + 6 }, (_, index) =>
      media(`p${index}.jpg`, true),
    );

    const kept = publishedOwnerMedia(list);

    expect(kept).toHaveLength(PUBLISHED_MEDIA_LIMIT);
    expect(kept[0].fileName).toBe('p0.jpg');
    expect(publishedOwnerMediaSources(list)).toHaveLength(PUBLISHED_MEDIA_LIMIT);
  });

  it('🔑 ο μετρητής της οθόνης και οι πηγές του ραφιού βγαίνουν από την ΙΔΙΑ συνάρτηση', () => {
    const list = Array.from({ length: 30 }, (_, index) => media(`p${index}.jpg`, index % 2 === 0));

    // Αν αυτά τα δύο αποκλίνουν, ο άνθρωπος βλέπει έναν αριθμό και ο κόσμος άλλον.
    expect(publishedOwnerMediaSources(list)).toHaveLength(publishedOwnerMedia(list).length);
  });

  it('το όριο είναι μέσα στο μετρημένο εύρος της έρευνας (22–27)', () => {
    expect(PUBLISHED_MEDIA_LIMIT).toBeGreaterThanOrEqual(22);
    expect(PUBLISHED_MEDIA_LIMIT).toBeLessThanOrEqual(27);
  });
});
