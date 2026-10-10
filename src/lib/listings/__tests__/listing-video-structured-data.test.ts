/**
 * @fileoverview **Το `VideoObject` της αγγελίας** — τι δηλώνεται σε ανιχνευτή και πότε σιωπά (ADR-907 §10.10).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Δ1: βίντεο χωρίς εξώφυλλο δηλώνεται (με κενή ή ξένη μικρογραφία).
 * - Δ2: μαντεμένο, μη εγκεκριμένο βίντεο δηλώνεται (ο κριτής του ADR-842 Α7 παρακάμφθηκε).
 * - Δ3: λείπει υποχρεωτικό πεδίο της Google (`name` · `thumbnailUrl` · `uploadDate`) ή το `contentUrl`.
 * - Δ4: η διάρκεια δεν είναι ISO 8601, ή γράφεται `PT0S` / `NaN`.
 * - Δ5: στιγμή που δεν διαβάζεται, κενός τίτλος ή σχετική διεύθυνση δηλώνονται αντί να σιωπούν.
 * - Δ6: δεύτερο βίντεο χάνεται σιωπηλά.
 * - Δ7: τίτλος με `</script>` σπάει το στοιχείο (η διαφυγή του `serializeJsonLd` δεν εφαρμόζεται στην έξοδο).
 */

import { serializeJsonLd } from '@/lib/seo/json-ld';

import { isoDurationFromSeconds, listingVideoStructuredData } from '../listing-video-structured-data';

const SHELF = 'https://storage.googleapis.com/public-shelf/listings/l1';

const POSTER = {
  url: `${SHELF}/poster-1024.webp`,
  width: 1024,
  height: 464,
  altKey: 'listing-detail:video.alt.agency',
  sources: [
    { url: `${SHELF}/poster-640.webp`, width: 640 },
    { url: `${SHELF}/poster-1024.webp`, width: 1024 },
  ],
};

const FILE = {
  url: `${SHELF}/clip.mp4`,
  altKey: 'listing-detail:video.alt.agency',
  width: 1024,
  height: 464,
  durationSec: 9.2,
  poster: POSTER,
};

const DECLARED = { provenance: 'declared', at: '2026-10-09T18:30:00.000Z', value: FILE };

function listing(videos: unknown[], title = 'Διαμέρισμα 85 τ.μ., Καλαμαριά') {
  return { id: 'l1', title, videos } as never;
}

describe('listingVideoStructuredData', () => {
  it('🔴 Δ3 δημοσιευμένο βίντεο με εξώφυλλο ⇒ VideoObject με τα υποχρεωτικά και τα συνιστώμενα πεδία', () => {
    expect(listingVideoStructuredData(listing([DECLARED]))).toEqual({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: 'Διαμέρισμα 85 τ.μ., Καλαμαριά',
      thumbnailUrl: [`${SHELF}/poster-1024.webp`, `${SHELF}/poster-640.webp`],
      uploadDate: '2026-10-09T18:30:00.000Z',
      contentUrl: `${SHELF}/clip.mp4`,
      encodingFormat: 'video/mp4',
      duration: 'PT9S',
    });
  });

  it('🔴 Δ1 χωρίς εξώφυλλο ⇒ κανένα VideoObject — ποτέ ψεύτικη μικρογραφία', () => {
    const withoutPoster = { ...DECLARED, value: { ...FILE, poster: null } };
    expect(listingVideoStructuredData(listing([withoutPoster]))).toBeNull();
  });

  it('🔴 Δ2 ό,τι δεν περνά τον κριτή προέλευσης δεν δηλώνεται σε ανιχνευτή', () => {
    const guessed = { ...DECLARED, provenance: 'inferred', confirmedAt: null };
    expect(listingVideoStructuredData(listing([guessed]))).toBeNull();

    const confirmed = { ...guessed, confirmedAt: '2026-10-09T19:00:00.000Z' };
    expect(listingVideoStructuredData(listing([confirmed]))).not.toBeNull();
  });

  it('κανένα βίντεο ⇒ null', () => {
    expect(listingVideoStructuredData(listing([]))).toBeNull();
  });

  it.each([
    ['στιγμή που δεν διαβάζεται', { ...DECLARED, at: 'χθες' }, undefined],
    ['σχετική διεύθυνση βίντεο', { ...DECLARED, value: { ...FILE, url: '/clip.mp4' } }, undefined],
    ['διεύθυνση http', { ...DECLARED, value: { ...FILE, url: 'http://example.com/clip.mp4' } }, undefined],
    ['κενός τίτλος', DECLARED, '   '],
  ])('🔴 Δ5 %s ⇒ σιωπή, όχι μισό VideoObject', (_label, video, title) => {
    expect(listingVideoStructuredData(listing([video], title))).toBeNull();
  });

  it('🔴 Δ5 εξώφυλλο με μόνο σχετικές διευθύνσεις ⇒ σιωπή (το thumbnailUrl είναι υποχρεωτικό)', () => {
    const relativePoster = { ...POSTER, url: '/poster.webp', sources: [{ url: '/poster.webp', width: 640 }] };
    const video = { ...DECLARED, value: { ...FILE, poster: relativePoster } };
    expect(listingVideoStructuredData(listing([video]))).toBeNull();
  });

  // Με δύο παράγωγα όπου το κανονικό είναι και το μεγαλύτερο, η σειρά «μεγαλύτερο πρώτο» βγαίνει σωστή ακόμη και χωρίς
  // την αντιστροφή. Τρία παράγωγα (το συνηθισμένο ράφι: 640 · 1024 · 2560) τη δείχνουν.
  it('🔴 Δ3β οι μικρογραφίες είναι ΟΛΑ τα παράγωγα, το μεγαλύτερο πρώτο, καμία δύο φορές', () => {
    const poster = {
      ...POSTER,
      url: `${SHELF}/poster-2560.webp`,
      sources: [...POSTER.sources, { url: `${SHELF}/poster-2560.webp`, width: 2560 }],
    };
    const video = { ...DECLARED, value: { ...FILE, poster } };

    expect(listingVideoStructuredData(listing([video]))).toMatchObject({
      thumbnailUrl: [`${SHELF}/poster-2560.webp`, `${SHELF}/poster-1024.webp`, `${SHELF}/poster-640.webp`],
    });
  });

  // Όταν το κανονικό είναι ένα από τα παράγωγα, η λίστα βγαίνει ίδια και χωρίς αυτό (μετάλλαξη Δ16, §10.11). Το
  // κανονικό είναι όμως η διεύθυνση που ζωγραφίζει η σκηνή — δηλώνεται πάντα, και πρώτο.
  it('🔴 Δ3γ το ΚΑΝΟΝΙΚΟ εξώφυλλο δηλώνεται πρώτο, ακόμη κι όταν δεν είναι ένα από τα παράγωγα', () => {
    const poster = { ...POSTER, url: `${SHELF}/poster-canonical.webp` };
    const video = { ...DECLARED, value: { ...FILE, poster } };

    expect(listingVideoStructuredData(listing([video]))).toMatchObject({
      thumbnailUrl: [`${SHELF}/poster-canonical.webp`, `${SHELF}/poster-1024.webp`, `${SHELF}/poster-640.webp`],
    });
  });

  it('η στιγμή κανονικοποιείται σε ISO με ζώνη (η Google αλλιώς υποθέτει τη ζώνη του Googlebot)', () => {
    const local = { ...DECLARED, at: '2026-10-09T21:30:00+03:00' };
    expect(listingVideoStructuredData(listing([local]))).toMatchObject({ uploadDate: '2026-10-09T18:30:00.000Z' });
  });

  it('διάρκεια που δεν διαβάζεται ⇒ το VideoObject μένει, χωρίς duration (συνιστώμενο, όχι υποχρεωτικό)', () => {
    const noDuration = { ...DECLARED, value: { ...FILE, durationSec: Number.NaN } };
    const data = listingVideoStructuredData(listing([noDuration]));
    expect(data).toMatchObject({ '@type': 'VideoObject' });
    expect(data).not.toHaveProperty('duration');
  });

  it('🔴 Δ6 δύο βίντεο ⇒ @graph με δύο VideoObject, με τη σειρά του εγγράφου', () => {
    const second = { ...DECLARED, value: { ...FILE, url: `${SHELF}/second.mp4` } };
    expect(listingVideoStructuredData(listing([DECLARED, second]))).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': [{ contentUrl: `${SHELF}/clip.mp4` }, { contentUrl: `${SHELF}/second.mp4` }],
    });
  });

  it('🔴 Δ7 τίτλος κατόχου με </script> δεν κλείνει το στοιχείο όταν σειριοποιηθεί', () => {
    const data = listingVideoStructuredData(listing([DECLARED], '</script><script>alert(1)</script>'));
    const text = serializeJsonLd(data);
    expect(text).not.toContain('</script>');
    expect(JSON.parse(text)).toMatchObject({ name: '</script><script>alert(1)</script>' });
  });
});

describe('isoDurationFromSeconds', () => {
  it.each([
    [9.2, 'PT9S'],
    // Στρογγύλευση στο ΠΛΗΣΙΕΣΤΕΡΟ, όπως το ρολόι της σκηνής — όχι αποκοπή.
    [9.6, 'PT10S'],
    [59.6, 'PT1M'],
    [0.2, 'PT1S'],
    [60, 'PT1M'],
    [120, 'PT2M'],
    [125, 'PT2M5S'],
    [3600, 'PT1H'],
    [3725, 'PT1H2M5S'],
  ])('🔴 Δ4 %s″ ⇒ %s', (seconds, expected) => {
    expect(isoDurationFromSeconds(seconds)).toBe(expected);
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])('🔴 Δ4 %s δεν είναι διάρκεια ⇒ null', (seconds) => {
    expect(isoDurationFromSeconds(seconds)).toBeNull();
  });
});
