/**
 * Άγκυρα — **Η ΤΑΥΤΟΤΗΤΑ ΑΠΟΦΑΣΙΖΕΤΑΙ ΑΠΟ ΤΗΝ ΤΙΜΗ, ΟΧΙ ΑΠΟ ΤΟ ΚΕΙΜΕΝΟ**
 *
 * ## Γιατί υπάρχει
 *
 * Το `handleBlur` έλυνε την επιλογή με `options.find(label === πληκτρολογημένο)`.
 * Όταν **δύο** επιλογές μοιράζονται ετικέτα, εκείνο επέστρεφε πάντα την **πρώτη**:
 * ο άνθρωπος διάλεγε τη δεύτερη, έφευγε από το πεδίο, και το blur **του άλλαζε
 * σιωπηλά την επιλογή**. Καμία ένδειξη — η φόρμα υποβαλλόταν με **άλλον άνθρωπο**.
 *
 * 🔴 **Δεν είναι υποθετικό.** Μετρήθηκε ζωντανά 2026-08-31 στον επιλογέα πελάτη της
 * οθόνης «νέα αγγελία για πελάτη»: η ανώνυμη επαφή έδινε ετικέτα `''` και το κλικ
 * πάνω της προσγειωνόταν σε **άλλη** επαφή (ADR-834 §6.5.στ).
 *
 * ⚠️ **Και είναι ΠΡΟΫΠΟΘΕΣΗ της άλλης θεραπείας, όχι έξτρα**: μόλις οι ανώνυμες επαφές
 * αποκτήσουν ονομασμένη ετικέτα («Επαφή χωρίς όνομα»), **δύο** από αυτές έχουν
 * **ταυτόσημη** ετικέτα. Χωρίς αυτό εδώ, η διόρθωση του κενού θα **γεννούσε** τη
 * σύγκρουση που έλυνε.
 *
 * ⛔ **Η αγκυρωμένη συμπεριφορά ΔΕΝ είναι «κράτα πάντα τον κάτοχο»** — είναι «ο κάτοχος
 * κερδίζει **μόνο όταν ταιριάζει κιόλας**». Ο πρώτος έλεγχος παρακάτω το κλειδώνει:
 * με μοναδικές ετικέτες η αναζήτηση με κείμενο δουλεύει ακριβώς όπως πριν.
 *
 * @module components/ui/__tests__/searchable-combobox-identity
 * @see ADR-834 §6.5.στ
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchableCombobox } from '../searchable-combobox';
import type { ComboboxOption } from '../searchable-combobox-types';

/** Η στιγμή που το `handleBlur` επιλύει την ταυτότητα (setTimeout 200ms). */
const BLUR_SETTLE_MS = 250;

const ANNA = 'cont_anna';
const FIRST_UNNAMED = 'cont_first_unnamed';
const SECOND_UNNAMED = 'cont_second_unnamed';

/** Το κείμενο που παίρνουν **όλες** οι επαφές χωρίς όνομα — γι' αυτό συγκρούονται. */
const UNNAMED = 'Επαφή χωρίς όνομα';

const OPTIONS: ComboboxOption[] = [
  { value: FIRST_UNNAMED, label: UNNAMED, secondaryLabel: 'protos@example.com' },
  { value: ANNA, label: 'Άννα Παπαδοπούλου', secondaryLabel: 'anna@example.com' },
  { value: SECOND_UNNAMED, label: UNNAMED, secondaryLabel: 'deuteros@example.com' },
];

function renderCombobox(value: string) {
  const onValueChange = jest.fn();
  render(
    <SearchableCombobox value={value} onValueChange={onValueChange} options={OPTIONS} />,
  );
  return { onValueChange, input: screen.getByRole('combobox') as HTMLInputElement };
}

function settleBlur(input: HTMLInputElement): void {
  fireEvent.blur(input);
  act(() => {
    jest.advanceTimersByTime(BLUR_SETTLE_MS);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('SearchableCombobox — ποιος αποφασίζει την ταυτότητα στο blur', () => {
  // -------------------------------------------------------------------------
  // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς αυτόν, ένα «δεν άλλαξε η επιλογή» θα ήταν πράσινο
  // και αν το blur είχε πάψει να λύνει **οτιδήποτε**.
  // -------------------------------------------------------------------------
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — με ΜΟΝΑΔΙΚΗ ετικέτα, το κείμενο εξακολουθεί να λύνει την επιλογή', () => {
    const { input, onValueChange } = renderCombobox(FIRST_UNNAMED);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Άννα Παπαδοπούλου' } });
    settleBlur(input);

    expect(onValueChange).toHaveBeenLastCalledWith(ANNA, expect.objectContaining({ value: ANNA }));
  });

  it('ΔΙΠΛΗ ετικέτα — ο κάτοχος ΜΕΝΕΙ· το blur δεν τον αντικαθιστά με τον πρώτο συνώνυμο', () => {
    // Ο άνθρωπος έχει ήδη επιλέξει τη ΔΕΥΤΕΡΗ ανώνυμη επαφή.
    const { input, onValueChange } = renderCombobox(SECOND_UNNAMED);

    // Το πεδίο δείχνει την κοινή ετικέτα — όπως ακριβώς μετά από `handleSelect`.
    expect(input.value).toBe(UNNAMED);

    settleBlur(input);

    // 🔴 Πριν τη διόρθωση: εδώ ερχόταν το `cont_first_unnamed`.
    expect(onValueChange).not.toHaveBeenCalledWith(FIRST_UNNAMED, expect.anything());
    expect(onValueChange).toHaveBeenLastCalledWith(
      SECOND_UNNAMED,
      expect.objectContaining({ value: SECOND_UNNAMED }),
    );
  });

  it('ΔΙΠΛΗ ετικέτα χωρίς κάτοχο — λύνεται κανονικά στον πρώτο συνώνυμο, δεν μένει κενό', () => {
    // Καμία προηγούμενη επιλογή: δεν υπάρχει κάτοχος να κερδίσει, οπότε το κείμενο
    // αποφασίζει. Χωρίς αυτόν τον έλεγχο, ένα «κράτα πάντα τον κάτοχο» θα περνούσε.
    const { input, onValueChange } = renderCombobox('');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: UNNAMED } });
    settleBlur(input);

    expect(onValueChange).toHaveBeenLastCalledWith(
      FIRST_UNNAMED,
      expect.objectContaining({ value: FIRST_UNNAMED }),
    );
  });
});
