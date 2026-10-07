/**
 * @fileoverview **Το ένα κέλυφος του προβολέα μέσων** — ό,τι υπόσχεται και στους δύο προσαρμογείς (εταιρικό · δημόσιο).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Κ1: καρτέλα χωρίς πλήθος (ή με 0) δείχνει «(0)» — ψευδές «άδειο» όσο ο προσαρμογέας φορτώνει.
 * - Κ2: το κέλυφος κρατά δική του ενεργή καρτέλα αντί να ρωτά τον προσαρμογέα (η διεύθυνση παύει να είναι η αλήθεια).
 * - Κ3: η σκηνή δείχνει περιεχόμενο πάνω από φόρτωση/σφάλμα, ή το «Επανάληψη» δεν καλεί τον προσαρμογέα.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Camera, Map } from 'lucide-react';

import { MediaViewerPanelState, MediaViewerShell, type MediaViewerTab } from '../viewer/MediaViewerShell';

const LABELS = { loading: 'Φόρτωση', error: 'Σφάλμα', retry: 'Επανάληψη' };

const TABS: MediaViewerTab[] = [
  { id: 'floorplans', label: 'Κάτοψη', icon: Map, panel: <p>σκηνή κάτοψης</p> },
  { id: 'photos', label: 'Φωτογραφίες', icon: Camera, count: 2, scroll: true, panel: <p>σκηνή φωτογραφιών</p> },
  { id: 'videos', label: 'Βίντεο', icon: Camera, count: 0, panel: <p>σκηνή βίντεο</p> },
];

describe('MediaViewerShell', () => {
  it('🔴 Κ1 το πλήθος φαίνεται μόνο όταν είναι θετικό', () => {
    render(<MediaViewerShell tabs={TABS} activeTab="floorplans" onTabChange={() => undefined} />);
    expect(screen.getByRole('tab', { name: /Φωτογραφίες/ }).textContent).toContain('(2)');
    expect(screen.getByRole('tab', { name: /Κάτοψη/ }).textContent).not.toContain('(');
    expect(screen.getByRole('tab', { name: /Βίντεο/ }).textContent).not.toContain('(');
  });

  it('🔴 Κ2 η ενεργή καρτέλα είναι ελεγχόμενη — το πάτημα ΡΩΤΑ, δεν αλλάζει', () => {
    const onTabChange = jest.fn();
    render(<MediaViewerShell tabs={TABS} activeTab="floorplans" onTabChange={onTabChange} />);

    const photos = screen.getByRole('tab', { name: /Φωτογραφίες/ });
    // Το Radix ενεργοποιεί στο mousedown (αριστερό κουμπί), όχι στο click.
    fireEvent.mouseDown(photos, { button: 0, ctrlKey: false });

    expect(onTabChange).toHaveBeenCalledWith('photos');
    expect(screen.getByRole('tab', { name: /Κάτοψη/ }).getAttribute('aria-selected')).toBe('true');
    expect(photos.getAttribute('aria-selected')).toBe('false');
  });

  /*
    🔴 Κ4 — βρέθηκε ΣΤΟΝ BROWSER (2026-10-07), όχι εδώ: το jsdom δεν έχει διάταξη. Στη δημόσια αγγελία το κέλυφος
    τεντωνόταν ως το ύψος της διπλανής στήλης (2.971px για περιεχόμενο 439px). Η άγκυρα καρφώνει την ΑΙΤΙΑ — ποιος
    κατέχει το ύψος — γιατί το σύμπτωμα μετριέται μόνο με πραγματική διάταξη.
  */
  it('🔴 Κ4 `flow`: το ύψος το κατέχει το περιεχόμενο — τίποτα δεν τεντώνεται ούτε ψαλιδίζει τη σκηνή', () => {
    const { container, rerender } = render(
      <MediaViewerShell tabs={TABS} activeTab="photos" onTabChange={() => undefined} layout="flow" />,
    );
    const stretchers = () => [...container.querySelectorAll('*')]
      .filter((el) => /(^|\s)(flex-1|h-full|overflow-auto)(\s|$)/.test(el.getAttribute('class') ?? ''));
    expect(stretchers()).toEqual([]);
    expect(screen.getByRole('tabpanel').parentElement?.className).not.toContain('overflow-hidden');

    // Η προεπιλογή μένει η συμπεριφορά του χώρου: γεμίζει τον γονιό και η σκηνή κυλά μέσα της.
    rerender(<MediaViewerShell tabs={TABS} activeTab="photos" onTabChange={() => undefined} />);
    expect(stretchers().length).toBeGreaterThan(0);
    expect(screen.getByRole('tabpanel').className).toContain('overflow-auto');
  });
});

describe('MediaViewerPanelState', () => {
  it('🔴 Κ3 φόρτωση και σφάλμα ΚΡΥΒΟΥΝ το περιεχόμενο · η επανάληψη καλεί τον προσαρμογέα', () => {
    const onRetry = jest.fn();
    const { rerender } = render(
      <MediaViewerPanelState loading error={null} onRetry={onRetry} labels={LABELS}><p>περιεχόμενο</p></MediaViewerPanelState>,
    );
    expect(screen.getByText('Φόρτωση')).toBeTruthy();
    expect(screen.queryByText('περιεχόμενο')).toBeNull();

    rerender(
      <MediaViewerPanelState loading={false} error={new Error('x')} onRetry={onRetry} labels={LABELS}><p>περιεχόμενο</p></MediaViewerPanelState>,
    );
    expect(screen.queryByText('περιεχόμενο')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Επανάληψη/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <MediaViewerPanelState loading={false} error={null} onRetry={onRetry} labels={LABELS}><p>περιεχόμενο</p></MediaViewerPanelState>,
    );
    expect(screen.getByText('περιεχόμενο')).toBeTruthy();
  });
});
