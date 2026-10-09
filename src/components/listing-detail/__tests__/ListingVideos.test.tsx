/**
 * @fileoverview **Το φύλλο του βίντεο** — ποιο υλικό φτάνει στον αγοραστή και τι λέγεται από κάτω του (ADR-907 §10.6).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Φ1: μαντεμένο, μη εγκεκριμένο βίντεο αποδίδεται (ο κριτής του ADR-842 Α7 παρακάμφθηκε).
 * - Φ2: χωρίς βίντεο το φύλλο τυπώνει κάτι (ονομασμένη απουσία για προαιρετικό υλικό).
 * - Φ3: η σημείωση προέλευσης είναι της φωτογραφίας/του μοντέλου, ή δεν ακολουθεί την `authorship`.
 * - Φ4: το `alt` δεν έρχεται από το `altKey` του εγγράφου.
 *
 * Προστέθηκαν μετά το πέρασμα μεταλλάξεων (ADR-907 §10.11) — ό,τι επέζησε τότε:
 * - Φ1β: ο κριτής ξαναγράφεται ως «μόνο δηλωμένο» (χάνεται εγκεκριμένο μάντεμα / μετρημένο), ή το δεύτερο βίντεο χάνεται.
 * - Φ3: τα αναμενόμενα κλειδιά είναι κυριολεκτικά — ανταλλαγή `agency` ↔ `ownerDeclared` στο μητρώο κοκκινίζει.
 * - Φ4β: το `alt` καρφώνεται ή παράγεται από την `authorship` αντί να διαβάζεται από το `altKey` κάθε βίντεο.
 * - (όλες) κλειδί που φτάνει αμετάφραστο στην οθόνη: η ψεύτικη `t` αφήνει ίχνος.
 */

import { render, screen } from '@testing-library/react';

import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { LISTING_VIDEO_NOTE_KEYS } from '@/lib/listings/listing-video-keys';

import { ListingVideos } from '../ListingVideos';

// Η μετάφραση ΑΦΗΝΕΙ ΙΧΝΟΣ: με ταυτοτική `t` ένα κλειδί που έφτασε ΑΜΕΤΑΦΡΑΣΤΟ στην οθόνη δεν ξεχώριζε από μεταφρασμένο.
const tr = (key: string): string => `t(${key})`;
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => `t(${key})` }) }));
jest.mock('../media/ListingVideoStage', () => ({
  ListingVideoStage: ({ video, alt }: { video: { url: string }; alt: string }) => (
    <div data-testid="stage" data-url={video.url} data-alt={alt} />
  ),
}));

const FILE = { altKey: 'listing-detail:video.alt.agency', width: 1920, height: 1080, durationSec: 60, poster: null };
const DECLARED = { value: { ...FILE, url: '/declared.mp4' }, provenance: 'declared' };
const GUESSED = { value: { ...FILE, url: '/guessed.mp4' }, provenance: 'inferred', confirmedAt: null };
// Μάντεμα που ΕΝΕΚΡΙΝΕ άνθρωπος, και μετρημένο: ο κριτής τα αφήνει. Χωρίς αυτά, ο κριτής ξαναγραμμένος ως
// `provenance === 'declared'` περνούσε όλες τις άγκυρες (μετάλλαξη §10.11).
const APPROVED = { value: { ...FILE, url: '/approved.mp4' }, provenance: 'inferred', confirmedAt: '2026-10-09T08:00:00.000Z' };
const MEASURED = { value: { ...FILE, url: '/measured.mp4' }, provenance: 'measured' };
// `altKey` που ΔΙΑΦΕΡΕΙ από την `authorship` της αγγελίας: μόνο έτσι φαίνεται από πού ήρθε η πρόταση.
const FOREIGN_ALT = { value: { ...FILE, url: '/foreign.mp4', altKey: 'listing-detail:video.alt.ownerDeclared' }, provenance: 'declared' };

function listing(videos: unknown[], authorship = 'agency') {
  return { id: 'l1', authorship, videos } as never;
}

describe('ListingVideos', () => {
  it('🔴 Φ1 μόνο ό,τι περνά τον κριτή προέλευσης φτάνει στη σκηνή', () => {
    render(<ListingVideos listing={listing([GUESSED, DECLARED])} />);
    expect(screen.getAllByTestId('stage').map((stage) => stage.getAttribute('data-url'))).toEqual(['/declared.mp4']);
  });

  it('🔴 Φ1β ο κριτής είναι ο `isPubliclyPresentable`, όχι «μόνο δηλωμένο» — και ΚΑΘΕ βίντεο που περνά παίρνει σκηνή', () => {
    render(<ListingVideos listing={listing([DECLARED, GUESSED, APPROVED, MEASURED])} />);
    // Τρεις σκηνές, με τη σειρά του εγγράφου: το δεύτερο και το τρίτο δεν χάνονται σιωπηλά.
    expect(screen.getAllByTestId('stage').map((stage) => stage.getAttribute('data-url'))).toEqual([
      '/declared.mp4',
      '/approved.mp4',
      '/measured.mp4',
    ]);
  });

  it('🔴 Φ2 κανένα βίντεο ⇒ τίποτα, ούτε ονομασμένη απουσία', () => {
    const empty = render(<ListingVideos listing={listing([])} />);
    expect(empty.container.innerHTML).toBe('');
    empty.unmount();

    const guessedOnly = render(<ListingVideos listing={listing([GUESSED])} />);
    expect(guessedOnly.container.innerHTML).toBe('');
  });

  // 🔴 Τα αναμενόμενα κλειδιά είναι ΚΥΡΙΟΛΕΚΤΙΚΑ, επίτηδες. Η πρώτη γραφή τα έπαιρνε από το ίδιο το
  // `LISTING_VIDEO_NOTE_KEYS` — κυκλικά: ανταλλαγή `agency` ↔ `ownerDeclared` στο μητρώο περνούσε (μετάλλαξη §10.11).
  it.each([
    ['agency', 'listing-detail:video.note.agency'],
    ['owner-declared', 'listing-detail:video.note.ownerDeclared'],
  ] as const)('🔴 Φ3 η σημείωση είναι του ΒΙΝΤΕΟ και ακολουθεί την authorship (%s)', (authorship, note) => {
    render(<ListingVideos listing={listing([DECLARED], authorship)} />);
    const keys = LISTING_MATERIAL_KEYS[authorship];

    expect(LISTING_VIDEO_NOTE_KEYS[authorship]).toBe(note);
    expect(screen.getByText(tr(note))).toBeTruthy();
    expect(screen.queryByText(tr(keys.modelNote))).toBeNull();
    expect(screen.queryByText(tr(keys.sourceNote))).toBeNull();
  });

  // Μετρημένο 2026-10-09: ως πεδίο του κοινού `Record` η σημείωση πέρασε το ταβάνι της σελίδας κάτοψης (1684 > 1502 bytes).
  it('🔴 Φ5 η σημείωση του βίντεο ΔΕΝ ζει στο κοινό `LISTING_MATERIAL_KEYS` — το πληρώνει κάθε διαδρομή που το εισάγει', () => {
    for (const keys of Object.values(LISTING_MATERIAL_KEYS)) {
      expect(Object.values(keys).filter((key) => key.includes(':video.note'))).toEqual([]);
    }
  });

  it('🔴 Φ4 το alt της σκηνής είναι το altKey του δημοσιευμένου εγγράφου', () => {
    render(<ListingVideos listing={listing([DECLARED])} />);
    expect(screen.getByTestId('stage').getAttribute('data-alt')).toBe(tr('listing-detail:video.alt.agency'));
    expect(screen.getByRole('region', { name: tr('listing-detail:media.tabs.video') })).toBeTruthy();
  });

  // Με ΕΝΑ fixture όπου `altKey` και `authorship` συμφωνούν, καρφωτό `alt` (ή `alt` παραγόμενο από την `authorship`)
  // έδινε την ίδια συμβολοσειρά (2 μεταλλάξεις §10.11). Το έγγραφο είναι η πηγή· η αγγελία δεν ξαναμαντεύει.
  it('🔴 Φ4β κάθε σκηνή παίρνει το `altKey` του ΔΙΚΟΥ της βίντεο — ακόμη κι όταν διαφέρει από την authorship', () => {
    render(<ListingVideos listing={listing([DECLARED, FOREIGN_ALT], 'agency')} />);
    expect(screen.getAllByTestId('stage').map((stage) => stage.getAttribute('data-alt'))).toEqual([
      tr('listing-detail:video.alt.agency'),
      tr('listing-detail:video.alt.ownerDeclared'),
    ]);
  });
});
