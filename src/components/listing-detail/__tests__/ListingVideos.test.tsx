/**
 * @fileoverview **Το φύλλο του βίντεο** — ποιο υλικό φτάνει στον αγοραστή και τι λέγεται από κάτω του (ADR-907 §10.6).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Φ1: μαντεμένο, μη εγκεκριμένο βίντεο αποδίδεται (ο κριτής του ADR-842 Α7 παρακάμφθηκε).
 * - Φ2: χωρίς βίντεο το φύλλο τυπώνει κάτι (ονομασμένη απουσία για προαιρετικό υλικό).
 * - Φ3: η σημείωση προέλευσης είναι της φωτογραφίας/του μοντέλου, ή δεν ακολουθεί την `authorship`.
 * - Φ4: το `alt` δεν έρχεται από το `altKey` του εγγράφου.
 */

import { render, screen } from '@testing-library/react';

import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { LISTING_VIDEO_NOTE_KEYS } from '@/lib/listings/listing-video-keys';

import { ListingVideos } from '../ListingVideos';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../media/ListingVideoStage', () => ({
  ListingVideoStage: ({ video, alt }: { video: { url: string }; alt: string }) => (
    <div data-testid="stage" data-url={video.url} data-alt={alt} />
  ),
}));

const FILE = { altKey: 'listing-detail:video.alt.agency', width: 1920, height: 1080, durationSec: 60, poster: null };
const DECLARED = { value: { ...FILE, url: '/declared.mp4' }, provenance: 'declared' };
const GUESSED = { value: { ...FILE, url: '/guessed.mp4' }, provenance: 'inferred', confirmedAt: null };

function listing(videos: unknown[], authorship = 'agency') {
  return { id: 'l1', authorship, videos } as never;
}

describe('ListingVideos', () => {
  it('🔴 Φ1 μόνο ό,τι περνά τον κριτή προέλευσης φτάνει στη σκηνή', () => {
    render(<ListingVideos listing={listing([GUESSED, DECLARED])} />);
    expect(screen.getAllByTestId('stage').map((stage) => stage.getAttribute('data-url'))).toEqual(['/declared.mp4']);
  });

  it('🔴 Φ2 κανένα βίντεο ⇒ τίποτα, ούτε ονομασμένη απουσία', () => {
    const empty = render(<ListingVideos listing={listing([])} />);
    expect(empty.container.innerHTML).toBe('');
    empty.unmount();

    const guessedOnly = render(<ListingVideos listing={listing([GUESSED])} />);
    expect(guessedOnly.container.innerHTML).toBe('');
  });

  it.each(['agency', 'owner-declared'] as const)('🔴 Φ3 η σημείωση είναι του ΒΙΝΤΕΟ και ακολουθεί την authorship (%s)', (authorship) => {
    render(<ListingVideos listing={listing([DECLARED], authorship)} />);
    const keys = LISTING_MATERIAL_KEYS[authorship];
    const note = LISTING_VIDEO_NOTE_KEYS[authorship];

    expect(screen.getByText(note)).toBeTruthy();
    expect(screen.queryByText(keys.modelNote)).toBeNull();
    expect(screen.queryByText(keys.sourceNote)).toBeNull();
    expect(note).toMatch(/^listing-detail:video\.note\./);
  });

  // Μετρημένο 2026-10-09: ως πεδίο του κοινού `Record` η σημείωση πέρασε το ταβάνι της σελίδας κάτοψης (1684 > 1502 bytes).
  it('🔴 Φ5 η σημείωση του βίντεο ΔΕΝ ζει στο κοινό `LISTING_MATERIAL_KEYS` — το πληρώνει κάθε διαδρομή που το εισάγει', () => {
    for (const keys of Object.values(LISTING_MATERIAL_KEYS)) {
      expect(Object.values(keys).filter((key) => key.includes(':video.note'))).toEqual([]);
    }
  });

  it('🔴 Φ4 το alt της σκηνής είναι το altKey του δημοσιευμένου εγγράφου', () => {
    render(<ListingVideos listing={listing([DECLARED])} />);
    expect(screen.getByTestId('stage').getAttribute('data-alt')).toBe('listing-detail:video.alt.agency');
    expect(screen.getByRole('region', { name: 'listing-detail:media.tabs.video' })).toBeTruthy();
  });
});
