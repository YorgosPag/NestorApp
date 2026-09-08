/**
 * Άγκυρα — **Ο ΕΠΙΛΟΓΕΑΣ ΠΕΡΙΟΧΗΣ ΓΕΜΙΖΕΙ ΣΕ ΚΡΥΟ ΦΟΡΤΩΜΑ, ΧΩΡΙΣ ΕΠΑΝΑΠΡΟΣΑΡΤΗΣΗ**
 *
 * ## Γιατί υπάρχει — το περιστατικό, όχι η θεωρία
 *
 * 🔴 **2026-09-08, πρώτο ζωντανό άνοιγμα της Φάσης 1 σε φυλλομετρητή** *(ADR-846)*: στη
 * φόρμα της βιτρίνας, «Πού δραστηριοποιείστε» → πληκτρολογώ «Θέρμης» →
 * **«Καμία περιοχή δεν ταιριάζει με αυτό που γράφετε»**. Το ίδιο κείμενο, στην ίδια
 * στιγμή, δούλευε στο `/pro`. Το αρχείο των **20.721** οντοτήτων κατέβαινε κανονικά
 * *(HTTP 200)*. Πλοήγηση αλλού και πίσω — **δούλευε**.
 *
 * ⚠️ **Η αιτία δεν ήταν τα δεδομένα, ήταν μια ΨΕΥΤΙΚΗ ΛΙΣΤΑ ΕΞΑΡΤΗΣΕΩΝ**: το
 * `useAdministrativeHierarchy` επέστρεφε `useCallback(…, [])` πάνω σε μεταβλητές module.
 * Η ταυτότητα του `levelOptions` **δεν άλλαζε ποτέ**, ενώ αυτό που διάβαζε άλλαζε μία
 * φορά — όταν τελείωνε η φόρτωση. Άρα το `useMemo(…, [levelOptions])` του `AreaCombobox`
 * **δεν ξαναϋπολογιζόταν**: ο κατάλογος έμενε **άδειος για όλη τη ζωή της σελίδας**.
 * Το `/pro` γλίτωσε **κατά τύχη** *(το φίλτρο προσαρτάται αφού έχει ζεσταθεί το cache)*,
 * και η επαναπροσάρτηση «διόρθωνε» το σφάλμα — γι' αυτό ήταν αόρατο σε κάθε χειροκίνητη
 * δεύτερη ματιά.
 *
 * 🔑 **Η οθόνη έλεγε ΨΕΜΑ, όχι απλώς λάθος**: παρουσίαζε το *«δεν ξέρω»* ως
 * *«δεν υπάρχει»* — ακριβώς το σφάλμα που το ADR-846 απαγορεύει ρητά για το `/pro`.
 *
 * ## Τι φυλάει, και τι ΔΕΝ φυλάει
 *
 * ✅ Ότι **μία** προσάρτηση αρκεί: τα δεδομένα φτάνουν **μετά** το πρώτο render και ο
 *    κατάλογος τα δείχνει **χωρίς** να ξαναγεννηθεί το component.
 * ⛔ **ΔΕΝ** ελέγχει τον πληθυσμό των επιπέδων *(3-7)* — αυτό είναι απόφαση του
 *    `AreaCombobox` και έχει τη δική της τεκμηρίωση· εδώ μετριέται **η ροή**.
 *
 * ⚠️ **Η ΣΕΙΡΑ ΤΩΝ TEST ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ ΠΕΙΡΑΜΑΤΟΣ.** Το module cache είναι κοινό για
 * όλο το αρχείο και γράφεται **μόνο σε επιτυχία**. Το Κ1 *(αποτυχία δικτύου)* το αφήνει
 * κρύο επίτηδες, ώστε το Κ2 — η άγκυρα — να τρέξει σε **αληθινά κρύο** cache. Μη τα
 * αναδιατάξεις.
 *
 * @module components/mandate/__tests__/area-combobox-cold-load
 * @see ADR-846 · `src/hooks/useAdministrativeHierarchy.ts` *(η θεραπεία)*
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { AreaCombobox } from '../AreaCombobox';

// Ο hook καταγράφει την αποτυχία δικτύου· ο καταγραφέας δεν είναι το αντικείμενο εδώ.
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

const PLACEHOLDER = 'Πληκτρολογήστε δήμο, περιφέρεια ή κοινότητα';
const EMPTY_MESSAGE = 'Καμία περιοχή δεν ταιριάζει με αυτό που γράφετε';

/** Λίγο πάνω από το `DEFAULT_DEBOUNCE_MS` του SSoT (150ms). */
const DEBOUNCE_SETTLE_MS = 200;

/**
 * **Πέντε οντότητες, πραγματικού σχήματος** — αρκετές για να υπάρχει γονική αλυσίδα
 * *(ώστε να παραχθεί δευτερεύουσα ετικέτα)* και δεύτερος δήμος *(ώστε το φιλτράρισμα να
 * έχει τι να αποκλείσει)*.
 */
const PAYLOAD = {
  meta: { source: 'ΕΛΣΤΑΤ', date: '2026-01-01', counts: {}, levels: {} },
  data: [
    { id: 'region:12', n: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ', sn: 'ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ', nn: 'περιφερεια κεντρικης μακεδονιας', c: '12', p: null, l: 3 },
    { id: 'regionalUnit:1209', n: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ', sn: 'ΘΕΣΣΑΛΟΝΙΚΗΣ', nn: 'περιφερειακη ενοτητα θεσσαλονικης', c: '1209', p: 'region:12', l: 4 },
    { id: 'regionalUnit:1210', n: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΧΑΛΚΙΔΙΚΗΣ', sn: 'ΧΑΛΚΙΔΙΚΗΣ', nn: 'περιφερειακη ενοτητα χαλκιδικης', c: '1210', p: 'region:12', l: 4 },
    { id: 'municipality:1303', n: 'ΔΗΜΟΣ ΘΕΡΜΗΣ', sn: 'ΘΕΡΜΗΣ', nn: 'δημος θερμης', c: '1303', p: 'regionalUnit:1209', l: 5 },
    { id: 'municipality:1310', n: 'ΔΗΜΟΣ ΚΑΣΣΑΝΔΡΑΣ', sn: 'ΚΑΣΣΑΝΔΡΑΣ', nn: 'δημος κασσανδρας', c: '1310', p: 'regionalUnit:1210', l: 5 },
  ],
};

function renderPicker(): HTMLInputElement {
  render(
    <AreaCombobox
      value=""
      onValueChange={jest.fn()}
      placeholder={PLACEHOLDER}
      emptyMessage={EMPTY_MESSAGE}
    />,
  );
  return screen.getByRole('combobox') as HTMLInputElement;
}

/**
 * Πληκτρολόγηση **και εκκαθάριση του debounce**.
 *
 * ⚠️ Το `AreaCombobox` **δεν** δηλώνει `debounceMs`, άρα παίρνει το προεπιλεγμένο
 * `DEFAULT_DEBOUNCE_MS = 150`. Χωρίς προώθηση του χρόνου το ερώτημα μένει κενό και ο
 * κατάλογος δείχνει **όλες** τις επιλογές — δηλαδή ένα «φιλτράρει» που δεν
 * φιλτράρει και ένα πράσινο που δεν σημαίνει τίποτα.
 */
function type(input: HTMLInputElement, text: string): void {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  act(() => {
    jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
  });
}

/** Τα ορατά κείμενα του καταλόγου, με τη σειρά τους. */
function visibleRows(): string[] {
  return screen.queryAllByRole('option').map((li) => li.textContent ?? '');
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ADR-846 — ο επιλογέας περιοχής γεμίζει σε ΚΡΥΟ φόρτωμα', () => {
  // =========================================================================
  // Κ1 — Η ΑΠΟΤΥΧΙΑ ΔΕΝ ΡΙΧΝΕΙ ΤΗΝ ΟΘΟΝΗ, ΚΑΙ ΔΕΝ ΚΛΕΙΔΩΝΕΙ ΣΤΟ «ΦΟΡΤΩΝΩ».
  //      🔑 Τρέχει ΠΡΩΤΟ επίτηδες: αφήνει το module cache **κρύο** για το Κ2.
  // =========================================================================
  it('Κ1 — αποτυχία δικτύου: το πεδίο ζει, σταματά να φορτώνει, δεν δείχνει περιοχές', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('δεν υπάρχει δίκτυο'));

    const input = renderPicker();

    await act(async () => {
      await Promise.resolve();
    });

    type(input, 'Θερμη');

    expect(fetchMock).toHaveBeenCalled();
    expect(visibleRows()).toHaveLength(0);
    // Το πεδίο υπάρχει ακόμη — η οθόνη **δεν** εξαφανίστηκε.
    expect(input).toBeInTheDocument();
  });

  // =========================================================================
  // 🔴🔴 Κ2 — Η ΑΓΚΥΡΑ. Τα δεδομένα φτάνουν ΜΕΤΑ το πρώτο render, και φαίνονται
  //      **χωρίς** επαναπροσάρτηση. Πριν τη διόρθωση, το `visibleRows()` έμενε [].
  // =========================================================================
  it('Κ2 — τα δεδομένα φτάνουν μετά το render και ο κατάλογος τα δείχνει ΧΩΡΙΣ remount', async () => {
    let release!: () => void;
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve({ json: async () => PAYLOAD } as Response);
        }),
    );

    const input = renderPicker();

    // ── ΠΑΡΟΝΟΜΑΣΤΗΣ: όσο εκκρεμεί, κανένας κατάλογος ΚΑΙ καμία διαβεβαίωση απουσίας ──
    type(input, 'Θερμη');
    expect(visibleRows()).toHaveLength(0);
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();

    // ── Φτάνουν τα δεδομένα. Το ΙΔΙΟ component, καμία δεύτερη προσάρτηση. ──
    await act(async () => {
      release();
      await Promise.resolve();
    });

    const rows = visibleRows();
    expect(rows).not.toHaveLength(0);
    expect(rows.some((row) => row.includes('ΔΗΜΟΣ ΘΕΡΜΗΣ'))).toBe(true);
    // Το φίλτρο είναι φίλτρο: ο άλλος δήμος **δεν** περνά.
    expect(rows.some((row) => row.includes('ΚΑΣΣΑΝΔΡΑΣ'))).toBe(false);
  });

  // =========================================================================
  // Κ3 — ΤΟ ΕΙΔΟΣ ΕΙΝΑΙ ΜΠΡΟΣΤΑ. Χωρίς αυτό, «Θεσσαλονίκης» εμφανίζεται τρεις
  //      φορές ταυτόσημα και σημαίνει τρεις **πολύ** διαφορετικές εμβέλειες.
  //      *(Cache ζεστό από το Κ2 — εδώ δεν μετριέται η ροή, μετριέται η ετικέτα.)*
  // =========================================================================
  it('Κ3 — κάθε γραμμή δηλώνει το ΕΠΙΠΕΔΟ της, και ο τόνος δεν εμποδίζει την εύρεση', () => {
    const input = renderPicker();

    // Χωρίς τόνο, πεζά — όπως γράφει ο βιαστικός άνθρωπος.
    type(input, 'θερμη');

    const rows = visibleRows();
    expect(rows.some((row) => row.includes('ΔΗΜΟΣ ΘΕΡΜΗΣ') && row.includes('Δήμος'))).toBe(true);
  });
});
