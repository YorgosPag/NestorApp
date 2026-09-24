/**
 * =============================================================================
 * ADR-841 §7 **Α14.7** — **Η ΟΘΟΝΗ ΤΗΣ ΣΕΙΡΑΣ, ΕΚΤΕΛΕΣΜΕΝΗ** *(Ο-16)*
 * =============================================================================
 *
 * Δύο ερωτήσεις, και η δεύτερη είναι που κοστίζει αν λείψει:
 *
 *   1. *«δείχνει **ό,τι φεύγει**, με τη σειρά που φεύγει;»*
 *   2. *«η **πράξη** γράφεται — και, όταν ο διακομιστής την αρνηθεί, η οθόνη
 *      **γυρίζει πίσω** αντί να πει ψέματα;»*
 *
 * ⚠️ **ΜΟΝΤΑΡΕΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ COMPONENT** και το **πραγματικό** hook — ψεύτικα είναι
 * μόνο τα **σύνορα** *(η ανάγνωση αρχείων, ο γραφέας)*. Ό,τι μετριέται εδώ τρέχει.
 *
 * 🔑 **Τα κλειδιά ΔΕΝ αποδίδονται**: το `t` επιστρέφει το κλειδί, άρα κρίνεται *«ποιο
 * κλειδί ζήτησε η οθόνη»* — επιβιώνει κάθε αλλαγής διατύπωσης, κοκκινίζει σε κάθε αλλαγή
 * **συμπεριφοράς**.
 *
 * ⛔ **ΚΑΜΙΑ ΑΓΚΥΡΑ ΠΑΝΩ ΣΤΟ `hidden`** — μετρημένο μάθημα: το jsdom **δεν** εφαρμόζει
 * τον κανόνα `[hidden] { display: none }`, άρα κριτήριο που το υποθέτει είναι
 * **πράσινο-και-τυφλό**. Ο θανατηφόρος έλεγχος είναι η **απουσία στοιχείου**.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListingMediaOrderPanel } from '@/components/listings/ListingMediaOrderPanel';
import type { FileRecord } from '@/types/file-record';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

let filesFromFirestore: FileRecord[] = [];
jest.mock('@/components/shared/files/hooks/useEntityFiles', () => ({
  useEntityFiles: () => ({ files: filesFromFirestore, loading: false, error: null }),
}));

const updateProperty = jest.fn<Promise<{ success: boolean }>, [string, Record<string, unknown>]>();
jest.mock('@/services/properties.service', () => ({
  updateProperty: (id: string, updates: Record<string, unknown>) => updateProperty(id, updates),
}));

const PROPERTY_ID = 'prop_a0000004-7777-4aaa-8aaa-000000000004';
const COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

function photo(id: string, over: Partial<FileRecord> = {}): FileRecord {
  return {
    id,
    entityType: 'property',
    entityId: PROPERTY_ID,
    storagePath: `companies/${COMPANY_ID}/entities/property/${PROPERTY_ID}/photos/${id}.jpg`,
    displayName: `Φωτογραφία ${id}`,
    category: 'photos',
    classification: 'public',
    contentType: 'image/jpeg',
    status: 'ready',
    createdAt: '2026-08-20T10:00:00.000Z',
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  } as unknown as FileRecord;
}

const A = photo('file_a', { createdAt: '2026-08-01T10:00:00.000Z' });
const B = photo('file_b', { createdAt: '2026-08-02T10:00:00.000Z' });
const C = photo('file_c', { createdAt: '2026-08-03T10:00:00.000Z' });

function mount(storedOrder: unknown) {
  return render(
    <ListingMediaOrderPanel
      propertyId={PROPERTY_ID}
      companyId={COMPANY_ID}
      storedOrder={storedOrder}
    />,
  );
}

/**
 * Το κουμπί «να μπει πρώτη» — **κατά όνομα**, ποτέ κατά θέση: η γραμμή φιλοξενεί και άλλα χειριστήρια (ADR-880
 * «Εστίαση»), και ένα `getAllByRole('button')[1]` θα πατούσε ό,τι έτυχε να είναι δεύτερο.
 */
const MAKE_FIRST = { name: 'property-market:listing.mediaOrder.makeFirst' } as const;
const makeFirstButtons = (): HTMLElement[] => screen.getAllByRole('button', MAKE_FIRST);

/** Τα ονόματα των αρχείων **με τη σειρά που τα ζωγράφισε η οθόνη**. */
function shownOrder(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
    .map((text) => (text.match(/file_[a-z]/) ?? [''])[0]);
}

beforeEach(() => {
  filesFromFirestore = [];
  updateProperty.mockReset();
  updateProperty.mockResolvedValue({ success: true });
});

// ============================================================================
// Ο1 — Η ΟΘΟΝΗ ΔΕΙΧΝΕΙ Ο,ΤΙ ΦΕΥΓΕΙ
// ============================================================================

describe('Ο1 — ΤΙ ΔΕΙΧΝΕΙ', () => {
  /**
   * 🔴 **ΤΟ ΚΡΙΤΗΡΙΟ ΤΟΥ ΣΗΜΑΤΟΣ ΓΡΑΦΤΗΚΕ ΔΥΟ ΦΟΡΕΣ** *(μετρημένο, Μ14)*. Η πρώτη εκδοχή
   * μετρούσε **ΠΛΗΘΟΣ** *(«υπάρχει ακριβώς ένα σήμα»)* — και μετάλλαξη `index === 0` →
   * `index === 1` **ΕΠΕΖΗΣΕ**: το σήμα μετακόμισε στο **δεύτερο** στοιχείο, αλλά έμεινε
   * **ένα**. 🔑 Το ερώτημα δεν είναι *«πόσα;»*, είναι ***«σε ΠΟΙΟ;»*** — και απαντιέται
   * μόνο με `within(το πρώτο στοιχείο)`.
   */
  it('🔴 χωρίς δήλωση: σειρά ΧΡΟΝΟΥ, και το σήμα «1η» είναι ΜΕΣΑ ΣΤΟ ΠΡΩΤΟ στοιχείο', () => {
    filesFromFirestore = [C, A, B];
    mount(undefined);

    expect(shownOrder()).toEqual(['file_a', 'file_b', 'file_c']);

    const items = screen.getAllByRole('listitem');
    expect(
      within(items[0]).getByText('property-market:listing.mediaOrder.firstBadge'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('property-market:listing.mediaOrder.firstBadge')).toHaveLength(1);
  });

  it('🔴 ΤΟ ΣΗΜΑ ΑΚΟΛΟΥΘΕΙ ΤΗ ΔΗΛΩΣΗ — δεν είναι καρφωμένο σε θέση πίνακα', () => {
    filesFromFirestore = [A, B, C];
    mount(['file_c']);

    const items = screen.getAllByRole('listitem');
    expect(
      within(items[0]).getByText('property-market:listing.mediaOrder.firstBadge'),
    ).toBeInTheDocument();
    expect(items[0].textContent).toContain('file_c');
  });

  it('🔴 με δήλωση: η ΔΗΛΩΜΕΝΗ είναι πρώτη, ουρά από πίσω', () => {
    filesFromFirestore = [A, B, C];
    mount(['file_c']);

    expect(shownOrder()).toEqual(['file_c', 'file_a', 'file_b']);
  });

  it('🔴 αρχείο ΜΗ δημόσιο ΔΕΝ εμφανίζεται — η οθόνη δεν υπόσχεται ό,τι δεν φεύγει', () => {
    filesFromFirestore = [A, photo('file_secret', { classification: 'internal' })];
    mount(['file_secret']);

    expect(shownOrder()).toEqual(['file_a']);
  });

  it('🔴 ΚΑΝΕΝΑ δημοσιεύσιμο ⇒ λέει ΤΙ ΝΑ ΚΑΝΕΙ ο άνθρωπος, και ΚΑΝΕΝΑ κουμπί', () => {
    filesFromFirestore = [photo('file_secret', { classification: 'internal' })];
    mount(undefined);

    expect(screen.getByText('property-market:listing.mediaOrder.empty')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

// ============================================================================
// Ο5 — ΣΗΜΕΙΟ ΕΣΤΙΑΣΗΣ (ADR-880 §5.2)
// ============================================================================

describe('Ο5 — «ΕΣΤΙΑΣΗ» ΣΕ ΚΑΘΕ ΔΗΜΟΣΙΑ ΦΩΤΟΓΡΑΦΙΑ', () => {
  /**
   * 🔴 **Μετρημένο ζωντανά 24/09**: η πρώτη εκδοχή έκρυβε το χειριστήριο όταν έλειπε το `downloadUrl` — και παλιές
   * εγγραφές γραφείου δεν το έχουν, ενώ η φωτογραφία είναι **ήδη δημόσια**. Τα fixtures εδώ **δεν** έχουν
   * `downloadUrl`, επίτηδες: τα bytes έρχονται από τον φρουρούμενο δρόμο του `fileId`.
   */
  it('🔴 κάθε γραμμή φωτογραφίας έχει «Εστίαση», ΚΑΙ χωρίς `downloadUrl`', () => {
    filesFromFirestore = [A, B, C];
    mount(undefined);

    for (const item of screen.getAllByRole('listitem')) {
      expect(within(item).getByRole('button', { name: 'property-market:photoFocalPoint.triggerAria' })).toBeInTheDocument();
    }
  });
});

// ============================================================================
// Ο2 — Η ΠΡΑΞΗ
// ============================================================================

describe('Ο2 — «ΝΑ ΜΠΕΙ ΠΡΩΤΗ»', () => {
  it('🔴 ΤΟ ΠΡΩΤΟ ΔΕΝ ΕΧΕΙ ΚΟΥΜΠΙ — «κάνε πρώτο κάτι που είναι ήδη πρώτο» δεν σημαίνει τίποτα', () => {
    filesFromFirestore = [A, B, C];
    mount(undefined);

    // ⚠️ **Απουσία στοιχείου**, όχι `disabled`/`hidden`: μόνο αυτό είναι θανατηφόρο σε jsdom.
    // ⚠️ Και ρωτιέται **ανά στοιχείο**, όχι ως πλήθος: πλήθος `2` μένει `2` και όταν το
    //    κουμπί λείπει από **λάθος** γραμμή (η μετάλλαξη Μ14 που επέζησε).
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).queryByRole('button', MAKE_FIRST)).toBeNull();
    expect(within(items[1]).getByRole('button', MAKE_FIRST)).toBeInTheDocument();
    expect(within(items[2]).getByRole('button', MAKE_FIRST)).toBeInTheDocument();
  });

  it('🔴 κλικ ⇒ ΓΡΑΦΕΤΑΙ η νέα δήλωση, με το πατημένο ΜΠΡΟΣΤΑ', async () => {
    filesFromFirestore = [A, B, C];
    mount(undefined);

    await userEvent.click(makeFirstButtons()[1]); // το τρίτο στοιχείο = file_c

    await waitFor(() => expect(updateProperty).toHaveBeenCalledTimes(1));
    expect(updateProperty).toHaveBeenCalledWith(PROPERTY_ID, {
      publishedMediaOrder: ['file_c'],
    });
  });

  it('🔴 ΑΙΣΙΟΔΟΞΑ: η οθόνη αναδιατάσσεται ΠΡΙΝ γυρίσει το έγγραφο', async () => {
    filesFromFirestore = [A, B, C];
    mount(undefined);

    await userEvent.click(makeFirstButtons()[1]);

    // Το `storedOrder` παρέμεινε `undefined` — η νέα σειρά είναι **αποκλειστικά** τοπική.
    await waitFor(() => expect(shownOrder()).toEqual(['file_c', 'file_a', 'file_b']));
  });

  it('🔴 δεύτερη πράξη ΣΥΝΘΕΤΕΙ πάνω στην πρώτη — δεν ξεκινά από το μηδέν', async () => {
    filesFromFirestore = [A, B, C];
    mount(undefined);

    await userEvent.click(makeFirstButtons()[1]); // file_c πρώτο
    await waitFor(() => expect(shownOrder()).toEqual(['file_c', 'file_a', 'file_b']));

    await userEvent.click(makeFirstButtons()[1]); // τώρα το file_b
    await waitFor(() => expect(updateProperty).toHaveBeenCalledTimes(2));
    expect(updateProperty.mock.calls[1][1]).toEqual({
      publishedMediaOrder: ['file_b', 'file_c'],
    });
  });
});

// ============================================================================
// Ο3 — Η ΑΠΟΤΥΧΙΑ ΔΕΝ ΛΕΕΙ ΨΕΜΑΤΑ
// ============================================================================

describe('Ο3 — ΟΤΑΝ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΑΡΝΕΙΤΑΙ', () => {
  it('🔴 η οθόνη ΓΥΡΙΖΕΙ ΠΙΣΩ και το ΛΕΕΙ — ποτέ σιωπηλή ψεύτικη σειρά', async () => {
    updateProperty.mockRejectedValue(new Error('403'));
    filesFromFirestore = [A, B, C];
    mount(undefined);

    await userEvent.click(makeFirstButtons()[1]);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'property-market:listing.mediaOrder.saveFailed',
      ),
    );
    expect(shownOrder()).toEqual(['file_a', 'file_b', 'file_c']);
  });
});

// ============================================================================
// Ο4 — Η ΣΥΜΦΙΛΙΩΣΗ (το αισιόδοξο ΑΠΟΣΥΡΕΤΑΙ, δεν σκιάζει για πάντα)
// ============================================================================

describe('Ο4 — ΣΥΜΦΙΛΙΩΣΗ ΜΕ ΤΟ ΑΠΟΘΗΚΕΥΜΕΝΟ ΕΓΓΡΑΦΟ', () => {
  it('🔴 όταν το έγγραφο φτάσει με ΑΛΛΗ σειρά, η οθόνη ΤΗΝ ΑΚΟΛΟΥΘΕΙ', async () => {
    filesFromFirestore = [A, B, C];
    const view = mount(undefined);

    await userEvent.click(makeFirstButtons()[1]);
    await waitFor(() => expect(shownOrder()).toEqual(['file_c', 'file_a', 'file_b']));

    // Το έγγραφο επιστρέφει **ταυτόσημο** με το αισιόδοξο ⇒ το αισιόδοξο αποσύρεται…
    view.rerender(
      <ListingMediaOrderPanel
        propertyId={PROPERTY_ID}
        companyId={COMPANY_ID}
        storedOrder={['file_c']}
      />,
    );

    // …και μια **επόμενη** αλλαγή από αλλού (άλλη καρτέλα, συνάδελφος) φαίνεται.
    view.rerender(
      <ListingMediaOrderPanel
        propertyId={PROPERTY_ID}
        companyId={COMPANY_ID}
        storedOrder={['file_b']}
      />,
    );

    await waitFor(() => expect(shownOrder()).toEqual(['file_b', 'file_a', 'file_c']));
  });
});
