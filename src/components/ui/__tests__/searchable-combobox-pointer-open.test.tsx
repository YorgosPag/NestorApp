/**
 * ⚓ ADR-928 §5.24.5 #9 (= §5.20 #2) — «το combobox ανοίγει ΜΟΝΟ με πληκτρολόγηση».
 *
 * Μετρήθηκε στην παραγωγή: «Έργο» στον διάλογο «Νέα εντολή εργασίας» — `aria-expanded=false`, 0 επιλογές μετά από κλικ
 * στο πεδίο ή στο βέλος. Ρίζα στο ΚΟΙΝΟ component, όχι στον διάλογο:
 *   1. το άνοιγμα ζούσε μόνο στο `focus` — το πρώτο πεδίο ενός Radix Dialog είναι ΗΔΗ εστιασμένο (πριν φορτώσουν οι
 *      επιλογές), άρα το κλικ δεν γεννά `focus` και δεν ανοίγει τίποτα·
 *   2. το βέλος έπαιρνε την εστίαση ⇒ `blur` του input ⇒ κλείσιμο σε 200ms·
 *   3. το Radix μετρά το anchor ως «έξω» ⇒ το βέλος δεν μπορούσε να κλείσει (έκλεινε στο pointerdown, ξανάνοιγε στο click).
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableCombobox } from '../searchable-combobox';
import type { ComboboxOption } from '../searchable-combobox-types';

const OPTIONS: ComboboxOption[] = [
  { value: 'proj_a', label: 'Έργο Α' },
  { value: 'proj_b', label: 'Έργο Β' },
];

/** Το σενάριο του διαλόγου: εστίαση ΠΡΙΝ φτάσουν οι επιλογές (ζωντανή ανάγνωση), μετά φτάνουν. */
function renderFocusedBeforeOptions() {
  const view = render(<SearchableCombobox aria-label="Έργο" value="" onValueChange={jest.fn()} options={[]} isLoading />);
  const input = screen.getByRole('combobox');
  act(() => input.focus());
  view.rerender(<SearchableCombobox aria-label="Έργο" value="" onValueChange={jest.fn()} options={OPTIONS} />);
  return { input, chevron: screen.getByRole('button') };
}

const settle = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 260); }));

describe('SearchableCombobox — άνοιγμα με δείκτη (ADR-928 §5.24.5 #9)', () => {
  it('κλικ σε ΗΔΗ εστιασμένο πεδίο ανοίγει τον κατάλογο', async () => {
    const user = userEvent.setup();
    const { input } = renderFocusedBeforeOptions();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.click(input);

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('το βέλος ανοίγει και ο κατάλογος ΜΕΝΕΙ ανοιχτός (δεν κλέβει την εστίαση)', async () => {
    const user = userEvent.setup();
    const { input, chevron } = renderFocusedBeforeOptions();

    await user.click(chevron);
    await settle();

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('το βέλος σε ανοιχτό κατάλογο τον κλείνει', async () => {
    const user = userEvent.setup();
    const { input, chevron } = renderFocusedBeforeOptions();

    await user.click(chevron);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.click(chevron);
    await settle();

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('το βέλος σε ΜΗ εστιασμένο πεδίο ανοίγει και φέρνει την εστίαση στο πεδίο (πληκτρολόγιο συνεχίζει)', async () => {
    const user = userEvent.setup();
    render(<SearchableCombobox aria-label="Έργο" value="" onValueChange={jest.fn()} options={OPTIONS} />);
    const input = screen.getByRole('combobox');

    await user.click(screen.getByRole('button'));
    await settle();

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });
});
