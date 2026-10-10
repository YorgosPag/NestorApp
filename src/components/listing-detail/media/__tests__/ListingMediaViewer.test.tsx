/**
 * @fileoverview **Ο προβολέας μέσων της αγγελίας** — ο δημόσιος προσαρμογέας του κοινού κελύφους.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Π1: αγγελία με ΜΟΝΟ φωτογραφίες ζωγραφίζει λωρίδα με μία καρτέλα (θόρυβος) αντί για γυμνή συλλογή.
 * - Π2: καρτέλα για υλικό που το φύλλο της ΔΕΝ θα έδειχνε (μαντεμένο, μη εγκεκριμένο) ⇒ κενή σκηνή.
 * - Π3: η ενεργή καρτέλα δεν διαβάζεται από τη διεύθυνση, ή άγνωστη τιμή αφήνει κενή σκηνή αντί για «Φωτογραφίες».
 * - Π4: η προεπιλογή γράφεται στη διεύθυνση, ή η αλλαγή καρτέλας σβήνει άσχετα κλειδιά (`?guests=2`).
 * - Π5: η καρτέλα περιήγησης εμφανίζεται χωρίς παρουσία περιήγησης.
 * - Π8: καρτέλα «Κάτοψη ορόφου» χωρίς κάτοψη που το φύλλο θα έδειχνε (κενή σκηνή), ή σε λάθος θέση, ή με πλήθος.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ListingMediaViewer } from '../ListingMediaViewer';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/design-system', () => ({}), { virtual: true });
jest.mock('@/lib/listings/listing-images', () => ({ listingGalleryImages: () => [{}, {}, {}] }));

const tourPresence = jest.fn<boolean | undefined, [string]>();
jest.mock('@/lib/spatial-tour/useTourPresenceAvailable', () => ({
  useTourPresenceAvailable: (id: string) => tourPresence(id),
}));

jest.mock('../../ListingGallery', () => ({ ListingGallery: () => <div data-testid="gallery" /> }));
jest.mock('../../ListingFloorplans', () => ({
  ListingFloorplans: ({ embedded }: { embedded?: boolean }) => <div data-testid="floorplans" data-embedded={String(embedded)} />,
}));
jest.mock('../../ListingModels', () => ({ ListingModels: () => <div data-testid="models" /> }));
jest.mock('../../ListingTour', () => ({ ListingTour: () => <div data-testid="tour" /> }));
jest.mock('../../ListingVideos', () => ({ ListingVideos: () => <div data-testid="videos" /> }));
jest.mock('../../ListingFloorPlates', () => ({ ListingFloorPlates: () => <div data-testid="floor-plates" /> }));

const DECLARED = { value: { url: '/a', altKey: 'k' }, provenance: 'declared' };
const GUESSED = { value: { url: '/b', altKey: 'k' }, provenance: 'inferred', confirmedAt: null };
const APPROVED = { value: { url: '/c', altKey: 'k' }, provenance: 'inferred', confirmedAt: '2026-10-09T08:00:00.000Z' };

const OUTLINE = [0.1, 0.1, 0.4, 0.1, 0.4, 0.4, 0.1, 0.4];
const PLATE_IMAGE = { url: '/floor', width: 2000, height: 1000, altKey: 'k', sources: [] };
/** Κάτοψη ορόφου που ο ΑΛΗΘΙΝΟΣ κριτής (`presentableFloorPlate`) δέχεται: εικόνα με διαστάσεις, μία «αυτό το ακίνητο». */
const FLOOR_PLATE = {
  provenance: 'declared',
  value: { image: PLATE_IMAGE, units: [{ outline: OUTLINE, state: 'self' }, { outline: OUTLINE, state: 'available' }] },
};
/** Ίδια εικόνα, αλλά ΚΑΜΙΑ μονάδα δεν είναι «αυτό το ακίνητο» — το φύλλο δεν θα ζωγράφιζε τίποτα. */
const FLOOR_PLATE_WITHOUT_SELF = {
  provenance: 'declared',
  value: { image: PLATE_IMAGE, units: [{ outline: OUTLINE, state: 'available' }] },
};

function listing(floorplans: unknown[] = [], models: unknown[] = [], videos: unknown[] = [], floorPlates: unknown[] = []) {
  return { id: 'l1', floorplans, models, videos, floorPlates } as never;
}

function setQuery(query: string): void {
  window.history.replaceState(null, '', `/listing/l1${query}`);
}

beforeEach(() => {
  tourPresence.mockReturnValue(false);
  setQuery('');
});

describe('ListingMediaViewer', () => {
  it('🔴 Π1 μόνο φωτογραφίες ⇒ γυμνή συλλογή, καμία λωρίδα καρτελών', () => {
    render(<ListingMediaViewer listing={listing()} />);
    expect(screen.getByTestId('gallery')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('🔴 Π2 καρτέλα μόνο για υλικό που το φύλλο θα έδειχνε', () => {
    render(<ListingMediaViewer listing={listing([GUESSED], [DECLARED])} />);
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(names).toEqual(['listing-detail:media.tabs.photos(3)', 'listing-detail:model.heading']);
  });

  it('🔴 Π3 η διεύθυνση διαλέγει την καρτέλα · άγνωστη τιμή ⇒ Φωτογραφίες', () => {
    setQuery('?mediaTab=floorplan');
    const { unmount } = render(<ListingMediaViewer listing={listing([DECLARED])} />);
    expect(screen.getByTestId('floorplans').getAttribute('data-embedded')).toBe('true');
    expect(screen.queryByTestId('gallery')).toBeNull();
    unmount();

    setQuery('?mediaTab=model');
    render(<ListingMediaViewer listing={listing([DECLARED])} />);
    expect(screen.getByTestId('gallery')).toBeTruthy();
  });

  it('🔴 Π4 η αλλαγή γράφει ΜΟΝΟ το δικό της κλειδί · η προεπιλογή φεύγει από τη διεύθυνση', async () => {
    setQuery('?guests=2');
    render(<ListingMediaViewer listing={listing([DECLARED])} />);

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('tab', { name: /floorplan/ }), { button: 0, ctrlKey: false });
    });
    await waitFor(() => expect(screen.getByTestId('floorplans')).toBeTruthy());
    expect(window.location.search).toBe('?guests=2&mediaTab=floorplan');

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('tab', { name: /photos/ }), { button: 0, ctrlKey: false });
    });
    await waitFor(() => expect(screen.getByTestId('gallery')).toBeTruthy());
    expect(window.location.search).toBe('?guests=2');
  });

  it('🔴 Π5 καρτέλα περιήγησης μόνο με παρουσία περιήγησης', () => {
    const { unmount } = render(<ListingMediaViewer listing={listing([DECLARED])} />);
    expect(screen.queryByRole('tab', { name: /tour/ })).toBeNull();
    unmount();

    tourPresence.mockReturnValue(true);
    render(<ListingMediaViewer listing={listing()} />);
    expect(screen.getByRole('tab', { name: /tour/ })).toBeTruthy();
  });

  // Βρέθηκε στον browser (2026-10-07): με `fill` η κάρτα τεντωνόταν ως το ύψος του `aside` (2.971px για 439px).
  it('🔴 Π6 η αγγελία είναι έγγραφο ⇒ το κέλυφος δηλώνεται `flow`, ποτέ `fill`', () => {
    const { container } = render(<ListingMediaViewer listing={listing([DECLARED])} />);
    expect(container.querySelector('[data-media-viewer-layout]')?.getAttribute('data-media-viewer-layout')).toBe('flow');
  });

  // ADR-907 §10.6 — ως εδώ το `videos[]` γραφόταν στο δημόσιο έγγραφο και καμία οθόνη δεν το έδειχνε.
  it('🔴 Π7 το βίντεο είναι ΔΕΥΤΕΡΗ καρτέλα, χωρίς πλήθος — και μόνο όταν το φύλλο του θα το έδειχνε', () => {
    const { unmount } = render(<ListingMediaViewer listing={listing([DECLARED], [DECLARED], [DECLARED])} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'listing-detail:media.tabs.photos(3)',
      'listing-detail:media.tabs.video',
      'listing-detail:media.tabs.floorplan(1)',
      'listing-detail:model.heading',
    ]);
    unmount();

    // Μαντεμένο βίντεο ⇒ καμία καρτέλα· και επειδή μένουν μόνο οι φωτογραφίες, ούτε λωρίδα.
    const guessed = render(<ListingMediaViewer listing={listing([], [], [GUESSED])} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    guessed.unmount();

    // Μάντεμα που ΕΝΕΚΡΙΝΕ άνθρωπος ⇒ το φύλλο θα το έδειχνε, άρα υπάρχει καρτέλα. Χωρίς αυτό, ο κριτής ξαναγραμμένος
    // ως `provenance === 'declared'` περνούσε (μετάλλαξη §10.11) — και η καρτέλα θα έλειπε για υλικό που φαίνεται.
    const approved = render(<ListingMediaViewer listing={listing([], [], [APPROVED])} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'listing-detail:media.tabs.photos(3)',
      'listing-detail:media.tabs.video',
    ]);
    approved.unmount();

    setQuery('?mediaTab=video');
    render(<ListingMediaViewer listing={listing([], [], [DECLARED])} />);
    expect(screen.getByTestId('videos')).toBeTruthy();
    expect(screen.queryByTestId('gallery')).toBeNull();
  });

  // ADR-907 §11.9 — ως εδώ το `floorPlates[]` γραφόταν στο δημόσιο έγγραφο και καμία οθόνη δεν το έδειχνε.
  it('🔴 Π8 η κάτοψη ορόφου: αμέσως μετά την κάτοψη της μονάδας, χωρίς πλήθος — και μόνο όταν το φύλλο θα την έδειχνε', () => {
    const full = render(<ListingMediaViewer listing={listing([DECLARED], [DECLARED], [], [FLOOR_PLATE])} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'listing-detail:media.tabs.photos(3)',
      'listing-detail:media.tabs.floorplan(1)',
      'listing-detail:media.tabs.floorPlate',
      'listing-detail:model.heading',
    ]);
    full.unmount();

    // Χωρίς κάτοψη μονάδας η καρτέλα στέκεται μόνη της — η κάτοψη ορόφου δεν εξαρτάται από εκείνη.
    const alone = render(<ListingMediaViewer listing={listing([], [], [], [FLOOR_PLATE])} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'listing-detail:media.tabs.photos(3)',
      'listing-detail:media.tabs.floorPlate',
    ]);
    alone.unmount();

    // Κάτοψη που το φύλλο θα αρνιόταν ⇒ καμία καρτέλα· και επειδή μένουν μόνο οι φωτογραφίες, ούτε λωρίδα.
    const refused = render(<ListingMediaViewer listing={listing([], [], [], [FLOOR_PLATE_WITHOUT_SELF])} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    refused.unmount();

    const guessed = render(<ListingMediaViewer listing={listing([], [], [], [{ ...FLOOR_PLATE, provenance: 'inferred', confirmedAt: null }])} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    guessed.unmount();

    setQuery('?mediaTab=floorPlate');
    render(<ListingMediaViewer listing={listing([DECLARED], [], [], [FLOOR_PLATE])} />);
    expect(screen.getByTestId('floor-plates')).toBeTruthy();
    expect(screen.queryByTestId('gallery')).toBeNull();
    expect(screen.queryByTestId('floorplans')).toBeNull();
  });
});
