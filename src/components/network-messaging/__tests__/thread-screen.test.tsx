/**
 * @tests ADR-867 **Β9γ** — η οθόνη μιας συνομιλίας (`/messages/{threadId}`): Α-1…Α-7.
 *
 * ── ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ──
 *
 * Η οθόνη γεννήθηκε επειδή ο κατάλογος έδειχνε γραμμή που **δεν άνοιγε**: η σελίδα της πράξης δεν
 * υπάρχει στο γραφείο για αγγελία ιδιώτη. Οι άγκυρες εδώ φυλάνε τα σημεία όπου η επόμενη αλλαγή θα
 * ξαναέφτιαχνε την **ίδια** υπόσχεση, ένα επίπεδο πιο μέσα:
 *
 * • **Α-2** κάρτα **χωρίς** σύνδεσμο όταν η πράξη δεν ανοίγει — το «ποτέ Άνοιγμα προς το πουθενά».
 * • **Α-4** η όψη και η **ομάδα** έρχονται από τον διακομιστή· μια μαντεψιά στον πελάτη θα έδινε
 *   διαχείριση ομάδας σε ιδιοκτήτη.
 * • **Α-5** «δεν βρέθηκε» **χωρίς** «δοκιμάστε ξανά»: ξένο και ανύπαρκτο απαντούν ίδια (ADR-742),
 *   και ένα κουμπί επανάληψης θα καλούσε τον άνθρωπο να επιμείνει σε πόρτα που σωστά δεν ανοίγει.
 * • **Α-6** η ρίζα **δεν διεκδικεί γεωμετρία** — το μάθημα των ~390px (ADR-797).
 * • **Α-7** …αλλά **ζητά πλάτος με ΟΝΟΜΑ** (`data-shell-span="full"`) — το μάθημα των **37px**:
 *   χωρίς τη δήλωση, το πλαίσιο σύνθεσης έσπαγε το κείμενο ένα γράμμα ανά γραμμή.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { NetworkThreadScreen } from '../NetworkThreadScreen';

const THREAD = 'nthr_1';
const OWNP = 'ownp_1';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { readonly href: string; readonly children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

/** Η συνομιλία είναι βαριά και **δεν** είναι το αντικείμενο αυτών των αγκυρών — κρατάμε τα props της. */
const panelProps = jest.fn();
jest.mock('../NetworkThreadPanel', () => ({
  NetworkThreadPanel: (props: Record<string, unknown>) => {
    panelProps(props);
    return <section data-testid="panel" />;
  },
}));

const context = jest.fn();
const list = jest.fn();
jest.mock('@/services/network-messaging/network-thread.client', () => ({
  networkThreadClient: {
    context: (...args: unknown[]) => context(...args),
    list: (...args: unknown[]) => list(...args),
  },
}));

beforeEach(() => {
  panelProps.mockReset();
  context.mockReset();
  // Το πλαϊνό φύλλο μένει **κενό** επίτηδες: έτσι κάθε `<a>` που μετράμε ανήκει στη συνομιλία.
  list.mockReset().mockResolvedValue({ ok: true, value: { items: [], next: null } });
});

const ready = (patch: Record<string, unknown>) =>
  context.mockResolvedValue({
    ok: true,
    value: { success: true, side: 'host', teamId: null, subjectTitle: null, subjectHref: null, ...patch },
  });

describe('Α — η οθόνη μιας συνομιλίας', () => {
  it('Α-1 ο δρόμος πίσω υπάρχει ΠΑΝΤΑ — ο άνθρωπος φτάνει εδώ από ειδοποίηση, χωρίς ιστορικό', async () => {
    ready({});
    const { container } = render(<NetworkThreadScreen threadId={THREAD} />);

    await screen.findByTestId('panel');
    const back = container.querySelector('nav a');
    expect(back?.getAttribute('href')).toBe('/messages');
  });

  it('Α-2 🔴 ΠΡΑΞΗ ΠΟΥ ΔΕΝ ΑΝΟΙΓΕΙ: ΟΝΟΜΑ ΝΑΙ, ΣΥΝΔΕΣΜΟΣ ΟΧΙ (μετάλλαξη: δώσε πάντα σύνδεσμο)', async () => {
    ready({ subjectTitle: 'Δοκιμή από Ανώνυμη περιήγηση', subjectHref: null });
    const { container } = render(<NetworkThreadScreen threadId={THREAD} />);

    expect(await screen.findByText('Δοκιμή από Ανώνυμη περιήγηση')).toBeTruthy();
    expect(screen.getByText('network-messaging:context.noAccess')).toBeTruthy();
    // 🔴 **ΟΧΙ `queryByRole('link')`**: το μάθημα του Β9β — μετράμε τα ίδια τα `<a>`. Ο μόνος
    //    σύνδεσμος της οθόνης εδώ είναι ο δρόμος πίσω.
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('Α-3 ΠΡΑΞΗ ΠΟΥ ΑΝΟΙΓΕΙ ⇒ ο σύνδεσμος είναι εκεί, αυτούσιος από τον διακομιστή', async () => {
    const href = `/offers/${OWNP}#network-thread-${THREAD}`;
    ready({ side: 'counterpart', subjectTitle: 'Η αγγελία μου', subjectHref: href });
    const { container } = render(<NetworkThreadScreen threadId={THREAD} />);

    await screen.findByTestId('panel');
    const hrefs = [...container.querySelectorAll('a')].map((node) => node.getAttribute('href'));
    expect(hrefs).toContain(href);
  });

  it('Α-4 όψη και ΟΜΑΔΑ έρχονται από τον διακομιστή (μετάλλαξη: ίδια όψη για όλους)', async () => {
    ready({ side: 'host', teamId: 'ntem_1' });
    render(<NetworkThreadScreen threadId={THREAD} />);
    await screen.findByTestId('panel');
    expect(panelProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ threadId: THREAD, variant: 'office', teamId: 'ntem_1' }),
    );

    panelProps.mockClear();
    ready({ side: 'counterpart', teamId: null });
    render(<NetworkThreadScreen threadId={THREAD} />);
    await screen.findAllByTestId('panel');
    expect(panelProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ variant: 'owner', teamId: null }),
    );
  });

  it('Α-5 🔒 ΞΕΝΟ ή ΑΝΥΠΑΡΚΤΟ ⇒ «δεν βρέθηκε», ΧΩΡΙΣ «δοκιμάστε ξανά» και ΧΩΡΙΣ συνομιλία', async () => {
    context.mockResolvedValue({ ok: false, failure: 'not-audience', currentVersion: null });
    render(<NetworkThreadScreen threadId={THREAD} />);

    expect(await screen.findByText('network-messaging:screen.missing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /directory\.retry/ })).toBeNull();
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  it('Α-5β βλάβη ΔΙΚΤΥΟΥ ⇒ «δοκιμάστε ξανά» — εκεί η επιμονή έχει νόημα', async () => {
    context.mockResolvedValue({ ok: false, failure: 'unreachable', currentVersion: null });
    render(<NetworkThreadScreen threadId={THREAD} />);

    expect(await screen.findByRole('button', { name: /directory\.retry/ })).toBeTruthy();
  });

  it('Α-7 🔴 ΤΟ ΠΛΑΤΟΣ ΖΗΤΙΕΤΑΙ ΜΕ ΟΝΟΜΑ — `data-shell-span="full"` (μετάλλαξη: αφαίρεσή του ⇒ 37px composer)', async () => {
    // 🔴 **ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-09-21**: χωρίς αυτή τη δήλωση, με viewport 2400px το `<main>` ήταν
    //    **719px** (αυτο-διαστασιολογημένη στήλη του grid της επιφάνειας), το πλαϊνό φύλλο έπαιρνε 288
    //    και το πλαίσιο σύνθεσης **37px** — το κείμενο έσπαγε ένα γράμμα ανά γραμμή. Το είδε άνθρωπος
    //    σε στιγμιότυπο· η CHECK 3.63 έμεινε **πράσινη** (ρωτά «έγραψες γεωμετρία;», όχι «χωράει;»).
    ready({});
    const { container } = render(<NetworkThreadScreen threadId={THREAD} />);
    await screen.findByTestId('panel');

    const root = container.querySelector('main');
    expect(root?.getAttribute('data-shell-span')).toBe('full');
    // ⛔ Και **όχι** με ανώνυμο τρόπο: `w-screen` / `-mx-*` / `max-w-none` είναι το ίδιο αίτημα χωρίς
    //    όνομα, και η επόμενη αλλαγή του κελύφους θα τα έσπαγε σιωπηλά.
    expect(root?.className).not.toMatch(/(^|\s)(w-screen|-mx-|max-w-none)/);
  });

  it('Α-6 🔴 Η ΡΙΖΑ ΔΕΝ ΔΙΕΚΔΙΚΕΙ ΓΕΩΜΕΤΡΙΑ — διάδρομο και μέτρο τα κατέχει το κέλυφος (ADR-797)', async () => {
    ready({});
    const { container } = render(<NetworkThreadScreen threadId={THREAD} />);
    await screen.findByTestId('panel');

    const root = container.querySelector('main');
    if (root === null) throw new Error('Η οθόνη δεν απέδωσε ρίζα.');
    // Ίδια ερώτηση με τον κατάλογο: **καμία** κλάση κεντραρίσματος/ταβανιού/εσωτερικού περιθωρίου —
    // και **καμία** κλάση ύψους, που ήταν η δεύτερη μισή αιτία των ~390px.
    expect(root.className).not.toMatch(/(^|\s)(mx-auto|max-w-|p-\d|px-\d|py-\d|h-|min-h-)/);
  });
});
