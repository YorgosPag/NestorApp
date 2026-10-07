/**
 * @fileoverview **Ο εταιρικός προσαρμογέας του προβολέα μέσων — ΕΚΤΕΛΕΣΜΕΝΟΣ** (ADR-907 §7).
 *
 * 🔴 Γιατί υπάρχει: το `viewer-narrow-layout.test.tsx` κάνει τον `ReadOnlyMediaViewer` **mock**, άρα καμία σουίτα δεν
 * τον εκτελούσε. Το ελάττωμα βρέθηκε στον browser (2026-10-07): μεζονέτα στην «Κάτοψη Ορόφου 1ος» → επιλογή διαμερίσματος
 * ενός επιπέδου ⇒ η διεύθυνση έδειχνε καρτέλα **άλλου** ακινήτου ⇒ καμία ενεργή καρτέλα, **κενή σκηνή**.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ε1: η ενεργή καρτέλα επικυρώνεται μόνο ως προς το ΣΧΗΜΑ της τιμής (`floorplan-floor-*`), όχι ως προς τις καρτέλες
 *       που υπάρχουν ⇒ κενή σκηνή.
 * - Ε2: η μπαγιάτικη τιμή μένει στη διεύθυνση ⇒ το `ListLayout` δείχνει `PropertyHoverInfo` πάνω σε κάτοψη μονάδας.
 * - Ε3: η διόρθωση γράφει ΠΡΙΝ γίνουν οριστικά τα επίπεδα ⇒ σβήνει έγκυρο βαθύ σύνδεσμο σε επίπεδο μεζονέτας.
 * - Ε4: η διόρθωση σβήνει άσχετα κλειδιά της διεύθυνσης (`view`, `selected`).
 * - Ε5: ακίνητο πολλών επιπέδων χωρίς παράμετρο ⇒ δεν ανοίγει στο πρώτο του επίπεδο.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ReadOnlyMediaViewer } from '../components/ReadOnlyMediaViewer';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, options?: { name?: string }) => (options?.name ? `${key}:${options.name}` : key) }),
}));
jest.mock('@/lib/design-system', () => ({}), { virtual: true });
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/auth/contexts/AuthContext', () => ({ useAuth: () => ({ user: { companyId: 'comp_1' } }) }));
jest.mock('@/lib/files/file-custody', () => ({ companyReadCustodyOf: (companyId: string) => ({ companyId }) }));

const IDLE = { files: [], loading: false, error: null, refetch: jest.fn() };
jest.mock('@/components/shared/files/hooks/useEntityFiles', () => ({ useEntityFiles: () => IDLE }));
jest.mock('@/hooks/useFloorFloorplans', () => ({
  useFloorFloorplans: () => ({ floorFloorplan: null, loading: false, error: null, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useFloorOverlays', () => ({ useFloorOverlays: () => ({ overlays: [] }) }));
jest.mock('@/hooks/useBackgroundScale', () => ({ useBackgroundScale: () => ({ unitsPerMeter: null, backgroundId: null }) }));

jest.mock('@/components/shared/files/media/FloorplanGallery', () => ({
  FloorplanGallery: ({ floorplanId }: { floorplanId?: string | null }) => (
    <div data-testid={floorplanId === undefined ? 'unit-floorplan-stage' : 'floor-floorplan-stage'} />
  ),
}));
jest.mock('@/components/shared/files/media/MediaGallery', () => ({ MediaGallery: () => <div data-testid="gallery-stage" /> }));
jest.mock('../components/ReadOnlyMediaSubTabs', () => ({
  TabContentWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FloorFloorplanTabContent: ({ floorId }: { floorId: string }) => <div data-testid={`floor-level-${floorId}`} />,
  UnitFloorplanTabContent: ({ levelFloorId }: { levelFloorId: string }) => <div data-testid={`unit-level-${levelFloorId}`} />,
}));

const MAISONETTE_LEVELS = [
  { floorId: 'flr_1', floorNumber: 1, name: '1ος' },
  { floorId: 'flr_2', floorNumber: 2, name: '2ος' },
];

function setQuery(query: string): void {
  window.history.replaceState(null, '', `/o/comp_1/properties${query}`);
}

const activeTabName = (): string | null =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? null;

beforeEach(() => setQuery(''));

describe('ReadOnlyMediaViewer — η ενεργή καρτέλα απέναντι στις καρτέλες που υπάρχουν', () => {
  it('🔴 Ε1+Ε2+Ε4 καρτέλα άλλου ακινήτου στη διεύθυνση ⇒ πρώτη καρτέλα, ποτέ κενή σκηνή · η διεύθυνση διορθώνεται', async () => {
    setQuery('?view=floorplan&selected=prop_2&mediaTab=floorplan-floor-flr_1');
    render(<ReadOnlyMediaViewer propertyId="prop_2" levelsSettled />);

    expect(activeTabName()).toContain('viewer.media.floorplanUnit');
    expect(screen.getByTestId('unit-floorplan-stage')).toBeTruthy();
    await waitFor(() => expect(window.location.search).toBe('?view=floorplan&selected=prop_2'));
  });

  it('🔴 Ε3 όσο τα επίπεδα ΔΕΝ είναι οριστικά, ο βαθύς σύνδεσμος σε επίπεδο μεζονέτας δεν σβήνεται', async () => {
    setQuery('?selected=prop_1&mediaTab=floorplan-floor-flr_2');
    // Η επιλογή ήρθε από τη διεύθυνση, το ακίνητο δεν έχει φορτώσει ακόμη: κανένα `levels`, καμία βεβαιότητα.
    const { rerender } = render(<ReadOnlyMediaViewer propertyId="prop_1" />);
    await act(async () => undefined);
    expect(window.location.search).toBe('?selected=prop_1&mediaTab=floorplan-floor-flr_2');

    rerender(<ReadOnlyMediaViewer propertyId="prop_1" levels={MAISONETTE_LEVELS} levelsSettled />);
    expect(screen.getByTestId('floor-level-flr_2')).toBeTruthy();
    await act(async () => undefined);
    expect(window.location.search).toBe('?selected=prop_1&mediaTab=floorplan-floor-flr_2');
  });

  it('🔴 Ε5 πολλά επίπεδα χωρίς παράμετρο ⇒ η κάτοψη του ΠΡΩΤΟΥ επιπέδου, χωρίς εγγραφή στη διεύθυνση', async () => {
    render(<ReadOnlyMediaViewer propertyId="prop_1" levels={MAISONETTE_LEVELS} levelsSettled />);
    expect(screen.getByTestId('unit-level-flr_1')).toBeTruthy();
    await act(async () => undefined);
    expect(window.location.search).toBe('');
  });

  it('η αλλαγή καρτέλας γράφει ΜΟΝΟ το δικό της κλειδί και η σκηνή ακολουθεί', async () => {
    setQuery('?view=floorplan&selected=prop_2');
    render(<ReadOnlyMediaViewer propertyId="prop_2" levelsSettled />);

    await act(async () => {
      // Το Radix ενεργοποιεί στο mousedown (αριστερό κουμπί), όχι στο click.
      fireEvent.mouseDown(screen.getByRole('tab', { name: /viewer\.media\.photos/ }), { button: 0, ctrlKey: false });
    });
    await waitFor(() => expect(screen.getByTestId('gallery-stage')).toBeTruthy());
    expect(window.location.search).toBe('?view=floorplan&selected=prop_2&mediaTab=photos');
  });
});
