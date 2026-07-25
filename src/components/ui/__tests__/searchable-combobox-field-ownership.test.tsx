/**
 * @fileoverview SearchableCombobox — ιδιοκτησία πεδίου (field ownership)
 *
 * Κλειδώνει τη συμπεριφορά που διορθώθηκε 2026-07-25 μετά από live παρατήρηση
 * στο AddressWithHierarchy: το reverse-geocoding auto-fill έγραψε «Θεσαλονίκης»
 * στο πεδίο οικισμού· ο χρήστης εστίασε και πληκτρολόγησε «Θεσσαλονί» με τον
 * δρομέα στο τέλος → η τιμή έγινε «ΘεσαλονίκηςΘεσσαλονί».
 *
 * Κανόνας: τιμή που έβαλε το ΣΥΣΤΗΜΑ = πρόταση → επιλέγεται ολόκληρη στο focus.
 *          Τιμή που έβαλε ο ΧΡΗΣΤΗΣ = δική του → ο δρομέας μένει άθικτος.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableCombobox } from '../searchable-combobox';
import type { ComboboxOption } from '../searchable-combobox-types';

const OPTIONS: ComboboxOption[] = [
  { value: 'settlement:0701010001', label: 'Θεσσαλονίκη' },
  { value: 'settlement:0701010002', label: 'Καλαμαριά' },
];

function renderCombobox(value: string, onValueChange = jest.fn()) {
  const utils = render(
    <SearchableCombobox
      value={value}
      onValueChange={onValueChange}
      options={OPTIONS}
      allowFreeText
    />,
  );
  return { ...utils, onValueChange, input: screen.getByRole('combobox') as HTMLInputElement };
}

describe('SearchableCombobox — field ownership', () => {
  it('επιλέγει ολόκληρη την τιμή του συστήματος στο focus (auto-fill = πρόταση)', () => {
    const { input } = renderCombobox('Θεσαλονίκης');

    expect(input.value).toBe('Θεσαλονίκης');

    fireEvent.focus(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Θεσαλονίκης'.length);
  });

  it('η πληκτρολόγηση ΑΝΤΙΚΑΘΙΣΤΑ την πρόταση — δεν προσκολλάται στο τέλος', () => {
    const { input, onValueChange } = renderCombobox('Θεσαλονίκης');

    fireEvent.focus(input);
    // Με το κείμενο επιλεγμένο, ο browser αντικαθιστά· προσομοιώνουμε το
    // αποτέλεσμα που ΠΡΕΠΕΙ να φτάσει στον handler.
    fireEvent.change(input, { target: { value: 'Θεσσαλονί' } });

    expect(input.value).toBe('Θεσσαλονί');
    expect(input.value).not.toBe('ΘεσαλονίκηςΘεσσαλονί');
    expect(onValueChange).toHaveBeenLastCalledWith('Θεσσαλονί', null);
  });

  it('ΔΕΝ ξαναεπιλέγει όταν την τιμή την έγραψε ο χρήστης', () => {
    const { input } = renderCombobox('');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Θεσσα' } });
    fireEvent.blur(input);
    fireEvent.focus(input);

    // Ο χρήστης κατέχει το πεδίο — καμία αυτόματη επιλογή κειμένου.
    expect(input.selectionStart).toBe(input.selectionEnd);
  });

  it('ΔΕΝ επιλέγει όταν το πεδίο είναι κενό', () => {
    const { input } = renderCombobox('');

    fireEvent.focus(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(0);
  });

  it('το mouseup μετά από select-all δεν χαλάει την επιλογή', () => {
    const { input } = renderCombobox('Θεσαλονίκης');

    fireEvent.focus(input);
    const prevented = !fireEvent.mouseUp(input);

    expect(prevented).toBe(true);
    expect(input.selectionEnd).toBe('Θεσαλονίκης'.length);
  });

  it('το επόμενο mouseup (χωρίς νέο focus) δεν εμποδίζεται', () => {
    const { input } = renderCombobox('Θεσαλονίκης');

    fireEvent.focus(input);
    fireEvent.mouseUp(input);
    // Δεύτερο κλικ μέσα στο ήδη εστιασμένο πεδίο → ο χρήστης τοποθετεί δρομέα.
    const prevented = !fireEvent.mouseUp(input);

    expect(prevented).toBe(false);
  });
});
