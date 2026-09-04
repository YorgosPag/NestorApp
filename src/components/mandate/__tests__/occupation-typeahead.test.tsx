/**
 * Άγκυρα — **ΤΟ ΠΕΔΙΟ ΕΙΔΙΚΟΤΗΤΑΣ ΠΛΗΚΤΡΟΛΟΓΕΙΤΑΙ, ΚΑΙ ΔΕΝ ΓΙΝΕΤΑΙ ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ**
 *
 * ## Γιατί υπάρχει
 *
 * Το `OccupationSelect` ήταν Radix `Select`: άνοιγε και κυλούσε. Με **22** επιλογές και
 * ετικέτες **54 χαρακτήρων** *(διπλό γένος ESCO)* το σκρολλάρισμα ήταν κουραστικό — ο
 * Giorgio το ζήτησε στις 2026-09-04 *(ADR-841 §7 **Α19**)*.
 *
 * 🔴🔴 **Ο ΛΟΓΟΣ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΟ**: η **Α4.5.6** είχε απορρίψει ρητά
 * το *«ελεύθερο κείμενο με autocomplete»* — αναζήτηση στα **2.942** ESCO, όπου το
 * «υδραυλικός» επιστρέφει **μηδέν χωρίς εξήγηση**. Η Α19 είναι **άλλο πράγμα**:
 * φιλτράρισμα **μέσα σε κλειστή λίστα 22 δηλωμένων**, όπου ο άνθρωπος **πάντα επιλέγει**.
 *
 * ⚠️ Η διαφορά είναι **μία γραμμή κώδικα** *(`allowFreeText`)* και **μία μέρα δουλειάς αν
 * χαθεί**. Το **Κ4** παρακάτω είναι ακριβώς αυτή η φύλαξη: αν κάποιος γυρίσει το
 * `allowFreeText` σε `true` «για ευκολία», η σουίτα **κοκκινίζει** — δεν το ανακαλύπτει
 * κανείς έξι μήνες μετά, όταν ένα πληκτρολογημένο *«υδραυλικος»* φύγει ως `occupation`
 * στη διεύθυνση και δώσει άδεια οθόνη.
 *
 * ⛔ **ΔΕΝ ελέγχεται εδώ ο πληθυσμός** *(`occupationOptions`)* — εκείνος έχει δική του
 * άγκυρα στο `showcase-filter.test.ts` και **δεν αγγίχθηκε** από την Α19.
 *
 * @module components/mandate/__tests__/occupation-typeahead
 * @see ADR-841 §7 Α19 · Α19.1 *(η διάκριση)* · Α19.4β *(το `aria-activedescendant`)*
 */

import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

import { OccupationSelect } from '../OccupationSelect';
import { ALL_OCCUPATIONS, type OccupationOption } from '@/lib/agency/showcase-filter';

// 🔑 **Πραγματικά κείμενα από το locale, ΟΧΙ το κλειδί**: το Κ2 μετρά **ελληνική**
//    κανονικοποίηση, και ένα `t = key => key` θα το έκανε να ελέγχει λατινικά κλειδιά —
//    δηλαδή πράσινο που δεν σημαίνει τίποτα.
jest.mock('@/i18n/hooks/useTranslation', () => {
  const bundle: Record<string, unknown> = jest.requireActual(
    '@/i18n/locales/el/property-market.json',
  );
  return {
    useTranslation: () => ({
      t: (key: string): string => {
        let node: unknown = bundle;
        for (const segment of key.replace(/^property-market:/, '').split('.')) {
          node = (node as Record<string, unknown> | undefined)?.[segment];
        }
        return typeof node === 'string' ? node : key;
      },
    }),
  };
});

/** Η στιγμή που το `handleBlur` του SSoT επιλύει την ταυτότητα (setTimeout 200ms). */
const BLUR_SETTLE_MS = 250;

/**
 * **22 ειδικότητες, από την πραγματική οθόνη** *(στιγμιότυπο 2026-09-04 12:14)*.
 *
 * ⚠️ Τα `escoUri` είναι συνθετικά· οι **ετικέτες** δεν είναι — κουβαλούν τους τόνους και
 * τα **δύο γένη** που γέννησαν και το ταβάνι πλάτους. Εκεί ζει η αξία του Κ2.
 */
const LABELS: readonly string[] = [
  'αγρονόμος τοπογράφος μηχανικός/αγρονόμος τοπογράφος μηχανικός',
  'αρχιτέκτονας/αρχιτέκτονας',
  'γεωτεχνικός μηχανικός/γεωτεχνική μηχανικός',
  'διακοσμητής εσωτερικών χώρων/διακοσμήτρια εσωτερικών χώρων',
  'ελαιοχρωματιστής οικοδομών/ελαιοχρωματίστρια οικοδομών',
  'ηλεκτρολόγος βιομηχανικών εγκαταστάσεων/ηλεκτρολόγος βιομηχανικών εγκαταστάσεων',
  'ηλεκτρολόγος κτιρίων/ηλεκτρολόγος κτιρίων',
  'ηλεκτρολόγος μηχανικός/ηλεκτρολόγος μηχανικός',
  'ηλεκτρομηχανολόγος μηχανικός/ηλεκτρομηχανολόγος μηχανικός',
  'κτίστης/κτίστρια',
  'μηχανολόγος μηχανικός/μηχανολόγος μηχανικός',
  'ξυλουργός/ξυλουργός',
  'πολιτικός μηχανικός/πολιτικός μηχανικός',
  'σιδεράς οικοδομών/σιδεράς οικοδομών',
  'τοποθετητής πλακιδίων/τοποθετήτρια πλακιδίων',
  'υδραυλικός εγκαταστάσεων θέρμανσης/υδραυλικός εγκαταστάσεων θέρμανσης',
  'χειριστής μηχανημάτων έργου/χειρίστρια μηχανημάτων έργου',
  'εργολάβος οικοδομών/εργολάβος οικοδομών',
  'τοπογράφος/τοπογράφος',
  'διαμεσολαβητής ακινήτων/διαμεσολαβήτρια ακινήτων',
  'ενεργειακός επιθεωρητής/ενεργειακή επιθεωρήτρια',
  'στατικός μηχανικός/στατική μηχανικός',
];

const OPTIONS: readonly OccupationOption[] = LABELS.map((label, i) => ({
  escoUri: `http://data.europa.eu/esco/occupation/test-${i}`,
  label: { el: label, en: `english-${i}` },
}));

/** Το «Όλες οι ειδικότητες» **προστίθεται** από το component ⇒ ο κατάλογος έχει 23. */
const TOTAL_ROWS = OPTIONS.length + 1;

/** Το κείμενο του locale — διαβασμένο, ποτέ γραμμένο δεύτερη φορά εδώ. */
const ALL_LABEL = 'Όλες οι ειδικότητες';

function renderField(value: string | null = null) {
  const onChange = jest.fn();
  render(
    <OccupationSelect value={value} options={OPTIONS} locale="el" onChange={onChange} />,
  );
  const input = screen.getByRole('combobox') as HTMLInputElement;
  return { onChange, input };
}

/** Πληκτρολόγηση + εκκαθάριση του (μηδενικού) debounce. */
function type(input: HTMLInputElement, text: string): void {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  act(() => {
    jest.advanceTimersByTime(50);
  });
}

/** Οι ορατές γραμμές του καταλόγου, με τη σειρά τους. */
function visibleRows(): string[] {
  return screen.queryAllByRole('option').map((li) => li.textContent ?? '');
}

// ⚠️ Το `scrollIntoView` **λείπει από το jsdom** και ο SSoT το καλεί στο `ArrowDown`. Το
//    στούμπωμα ζει στο `jest.setup.js`, δίπλα στον `ResizeObserver` — **ίδια κατηγορία**,
//    και το ζητά κάθε σουίτα που πλοηγείται με βέλη, όχι μόνο αυτή (N.0.2).

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('ADR-841 §7 Α19 — η ειδικότητα πληκτρολογείται μέσα σε ΚΛΕΙΣΤΗ λίστα', () => {
  // =========================================================================
  // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — χωρίς αυτόν, ένα «φιλτράρει σε 1» θα ήταν πράσινο και αν
  //    ο κατάλογος είχε πάψει να δείχνει **οτιδήποτε**.
  // =========================================================================
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — κλειστό: κανένας κατάλογος· ανοιχτό χωρίς κείμενο: ΚΑΙ ΟΙ 23', () => {
    const { input } = renderField();

    expect(visibleRows()).toHaveLength(0);

    fireEvent.focus(input);
    expect(visibleRows()).toHaveLength(TOTAL_ROWS);
    // Φ2 — η προεπιλογή είναι **γραμμένη**, και είναι **πρώτη**.
    expect(visibleRows()[0]).toBe(ALL_LABEL);
  });

  // =========================================================================
  // Κ1 — ΠΛΗΚΤΡΟΛΟΓΗΣΗ ΦΙΛΤΡΑΡΕΙ. Το αίτημα του Giorgio, εκτελεσμένο.
  // =========================================================================
  it('Κ1 — «ελαιο» ⇒ μένει ΜΙΑ επιλογή από τις 23', () => {
    const { input } = renderField();

    type(input, 'ελαιο');

    const rows = visibleRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('ελαιοχρωματιστής');
  });

  // =========================================================================
  // Κ2 — ΤΟ ΦΙΛΤΡΟ ΕΙΝΑΙ ΕΛΛΗΝΙΚΟ. Ο επισκέπτης δεν βάζει τόνους στη βιασύνη του.
  //      🔴 Αυτό είναι που κερδίζει ο SSoT και θα το έχανε δικό μου `includes()`.
  // =========================================================================
  it('Κ2 — «ηλεκτρολογος» ΧΩΡΙΣ ΤΟΝΟ βρίσκει τους τρεις τονισμένους', () => {
    const { input } = renderField();

    type(input, 'ηλεκτρολογος');

    const rows = visibleRows();
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toContain('ηλεκτρολόγος');
    // ⚠️ Ο «ηλεκτρομηχανολόγος» ΔΕΝ πιάνεται — αλλιώς το φίλτρο θα ήταν θόρυβος.
    expect(rows.some((r) => r.includes('ηλεκτρομηχανολόγος'))).toBe(false);
  });

  // =========================================================================
  // Κ3 — ΚΑΘΑΡΙΣΜΑ ⇒ ΞΑΝΑΓΙΝΟΝΤΑΙ 23. Καμία επιλογή δεν χάθηκε στην πορεία.
  // =========================================================================
  it('Κ3 — μετά το σβήσιμο του κειμένου ο κατάλογος επιστρέφει ΟΛΟΚΛΗΡΟΣ', () => {
    const { input } = renderField();

    type(input, 'ελαιο');
    expect(visibleRows()).toHaveLength(1);

    type(input, '');
    expect(visibleRows()).toHaveLength(TOTAL_ROWS);
  });

  // =========================================================================
  // 🔴🔴 Κ4 — Η ΤΙΜΗ ΠΟΥ ΦΕΥΓΕΙ ΕΙΝΑΙ ΠΑΝΤΑ escoUri. **ΕΔΩ ΖΕΙ Η Α19.1.**
  //      Αυτό ξεχωρίζει την Α19 από το ελεύθερο κείμενο που απέρριψε η Α4.5.6.
  // =========================================================================
  it('Κ4 — πληκτρολογημένο κείμενο ΔΕΝ εκπέμπεται ΠΟΤΕ, ούτε καν όταν ταιριάζει', () => {
    const { input, onChange } = renderField();

    type(input, 'ελαιο');

    // Ούτε μία εκπομπή όσο ο άνθρωπος γράφει — δεν υπάρχει «ενδιάμεση» τιμή.
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getAllByRole('option')[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted: unknown = onChange.mock.calls[0][0];
    expect(emitted).toBe(OPTIONS[4].escoUri);
    expect(emitted).toEqual(expect.stringContaining('data.europa.eu/esco'));
    // 🔒 Η ουσία: ό,τι κι αν πληκτρολογήθηκε, **δεν** είναι αυτό που έφυγε.
    expect(emitted).not.toBe('ελαιο');
  });

  it('Κ4β — κείμενο που ΔΕΝ ταιριάζει σε καμία επιλογή δεν φεύγει ούτε στο blur', () => {
    const { input, onChange } = renderField();

    // «υδραυλικός» γραμμένος ελεύθερα — ακριβώς η περίπτωση της Α4.5.6.
    type(input, 'υδραυλικος σκετος');
    fireEvent.blur(input);
    act(() => {
      jest.advanceTimersByTime(BLUR_SETTLE_MS);
    });

    for (const call of onChange.mock.calls) {
      expect(call[0]).not.toBe('υδραυλικος σκετος');
    }
  });

  // =========================================================================
  // Κ5 — ΤΟ SENTINEL ΔΕΝ ΔΙΑΡΡΕΕΙ. Ο καταναλωτής μιλά μόνο σε `string | null`.
  // =========================================================================
  it('Κ5 — το «Όλες οι ειδικότητες» εκπέμπει null, ΠΟΤΕ το «all»', () => {
    const { input, onChange } = renderField(OPTIONS[0].escoUri);

    fireEvent.focus(input);
    const allRow = screen.getAllByRole('option')[0];
    expect(within(allRow).getByText(ALL_LABEL)).toBeInTheDocument();

    fireEvent.mouseDown(allRow);

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onChange).not.toHaveBeenCalledWith(ALL_OCCUPATIONS);
  });

  it('Κ5β — το «×» (καθαρισμός) σημαίνει το ίδιο πράγμα: null', () => {
    const { onChange } = renderField(OPTIONS[0].escoUri);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // =========================================================================
  // Κ6 — Η ΠΛΟΗΓΗΣΗ ΑΝΑΚΟΙΝΩΝΕΤΑΙ (ADR-841 §7 Α19.4β).
  //      Χωρίς `aria-activedescendant` το ArrowDown μετακινούσε την επισήμανση
  //      **οπτικά** και ο αναγνώστης οθόνης δεν έλεγε τίποτα.
  // =========================================================================
  it('Κ6 — το ArrowDown δείχνει το aria-activedescendant στην ΕΠΙΣΗΜΑΣΜΕΝΗ επιλογή', () => {
    const { input } = renderField();

    fireEvent.focus(input);
    // Κλειστό/χωρίς επισήμανση: δεν δηλώνεται τίποτα — δείκτης σε ανύπαρκτο θα ήταν χειρότερος.
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const active = input.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();

    const target = document.getElementById(active as string);
    expect(target).not.toBeNull();
    expect(target).toHaveAttribute('role', 'option');
    expect(target).toHaveAttribute('aria-selected', 'true');
    // Και δείχνει στη γραμμή που **βλέπει** ο βλέπων — μία αλήθεια, δύο αισθήσεις.
    expect(target?.textContent).toBe(ALL_LABEL);
  });

  // =========================================================================
  // 🔴 Κ7 — ΤΟ ΕΥΡΗΜΑ ΤΟΥ ΠΕΡΠΑΤΗΜΑΤΟΣ (2026-09-04), ΟΧΙ ΤΟΥ TEST.
  //
  // Στη **ζωντανή** ρίζα: «ελαιο» → ArrowDown → Enter προσγειώθηκε στο **«Όλες οι
  // ειδικότητες»**. Αιτία: το `debouncedQuery` ενημερώνεται με `setTimeout`, άρα
  // υπήρχε **παράθυρο** όπου το πεδίο έλεγε «ελαιο» και ο κατάλογος ήταν ακόμη και οι
  // 23 — και το `Enter` επέλεγε τη θέση 0 της **αφιλτράριστης** λίστας.
  //
  // ⚠️ Χωρίς `advanceTimersByTime` εδώ — **αυτό ακριβώς** είναι το ζητούμενο.
  // =========================================================================
  it('Κ7 — πληκτρολόγηση + ArrowDown + Enter ΧΩΡΙΣ αναμονή επιλέγει από τη ΦΙΛΤΡΑΡΙΣΜΕΝΗ λίστα', () => {
    const { input, onChange } = renderField();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ελαιο' } });
    // 🔴 ΚΑΜΙΑ εκκαθάριση χρονομέτρων: ο άνθρωπος που γράφει γρήγορα δεν περιμένει.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    // Πριν τη διόρθωση εδώ ερχόταν `null` — το «Όλες οι ειδικότητες».
    expect(onChange).toHaveBeenCalledWith(OPTIONS[4].escoUri);
    expect(onChange).not.toHaveBeenCalledWith(null);
  });

  it('Κ6β — το listbox που δηλώνει το aria-controls ΥΠΑΡΧΕΙ στο DOM', () => {
    const { input } = renderField();

    fireEvent.focus(input);

    const controls = input.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toHaveAttribute('role', 'listbox');
  });
});
