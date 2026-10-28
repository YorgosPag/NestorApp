/**
 * Άγκυρα — **ΟΣΟ ΦΟΡΤΩΝΟΥΝ ΟΙ ΕΠΙΛΟΓΕΣ, ΠΟΤΕ ΩΜΗ ΤΑΥΤΟΤΗΤΑ ΣΤΟ ΠΕΔΙΟ**
 *
 * Μετρημένο ζωντανά 2026-10-28 (ADR-327 §8.5.4): η «Νέα Προσφορά» μέσα σε RFQ προσυμπληρώνει το έργο· για ~12 s, όσο
 * φόρτωναν τα έργα, το πεδίο «Έργο» έγραφε `proj_04a6b4bb-…`. Χωρίς ελεύθερο κείμενο η τιμή είναι **id**, όχι κείμενο.
 *
 * Λ1 φόρτωση + τιμή εκτός επιλογών ⇒ κενό πεδίο (φαίνεται ο spinner) · Λ2 μόλις έρθουν ⇒ η ετικέτα ·
 * Λ3 ελεύθερο κείμενο ⇒ η τιμή **είναι** κείμενο, φαίνεται και στη φόρτωση ·
 * Λ4 φόρτωση τελείωσε και η τιμή λείπει από τις επιλογές ⇒ μένει **ορατή** (ποτέ σιωπηλό κενό).
 *
 * @module components/ui/__tests__/searchable-combobox-loading-identity
 */

import { render, screen } from '@testing-library/react';
import { SearchableCombobox } from '../searchable-combobox';
import type { ComboboxOption } from '../searchable-combobox-types';

const ID = 'proj_04a6';
const OPTIONS: ComboboxOption[] = [{ value: ID, label: 'ΕΡΓΟ Α' }];
const noop = () => undefined;

function field(): HTMLInputElement {
  return screen.getByRole('combobox', { name: 'Έργο' }) as HTMLInputElement;
}

describe('SearchableCombobox — ταυτότητα στη φόρτωση', () => {
  it('Λ1 + Λ2: κενό όσο φορτώνει, ετικέτα όταν έρθουν οι επιλογές', () => {
    const { rerender } = render(
      <SearchableCombobox aria-label="Έργο" value={ID} onValueChange={noop} options={[]} isLoading />,
    );
    expect(field().value).toBe('');
    rerender(<SearchableCombobox aria-label="Έργο" value={ID} onValueChange={noop} options={OPTIONS} />);
    expect(field().value).toBe('ΕΡΓΟ Α');
  });

  it('Λ3: ελεύθερο κείμενο φαίνεται και στη φόρτωση', () => {
    render(<SearchableCombobox aria-label="Έργο" value="Οδός 1" onValueChange={noop} options={[]} isLoading allowFreeText />);
    expect(field().value).toBe('Οδός 1');
  });

  it('Λ4: εκτός επιλογών χωρίς φόρτωση ⇒ ορατή τιμή', () => {
    render(<SearchableCombobox aria-label="Έργο" value={ID} onValueChange={noop} options={[]} />);
    expect(field().value).toBe(ID);
  });
});
