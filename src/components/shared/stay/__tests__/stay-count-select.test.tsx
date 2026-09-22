/**
 * ADR-777 §8.60.21.7 — **ο επιλογέας δεν λέει ποτέ ψέματα για την ερώτηση**.
 *
 * 🔴 Ένα `<select>` με τιμή χωρίς `<option>` δείχνει την **πρώτη** επιλογή — εδώ «δεν το έχω
 * αποφασίσει» — για ερώτηση που **έγινε** (`?guests=12` με επιλογές 1–8, ή άτομα πάνω από το μέγιστο).
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { StayCountSelect, stayCountChoices, stayPetChoicesOf, STAY_PET_CHOICES } from '../StayCountSelect';

function renderSelect(value: number | null, choices: readonly number[]): HTMLSelectElement {
  render(<StayCountSelect label="Άτομα" anyLabel="—" choices={choices} value={value} onChange={() => undefined} />);
  return screen.getByLabelText('Άτομα') as HTMLSelectElement;
}

describe('StayCountSelect — η τιμή που ρωτήθηκε ΦΑΙΝΕΤΑΙ', () => {
  it('🔴 τιμή ΕΚΤΟΣ επιλογών ⇒ αποδίδεται (όχι «δεν το αποφάσισα»)', () => {
    expect(renderSelect(12, stayCountChoices(8)).value).toBe('12');
  });

  it('τιμή εντός επιλογών ⇒ καμία διπλή επιλογή', () => {
    const select = renderSelect(3, stayCountChoices(8));
    expect(select.value).toBe('3');
    expect(Array.from(select.options).filter((option) => option.value === '3')).toHaveLength(1);
  });

  it('`null` ⇒ «δεν το αποφάσισα»', () => {
    expect(renderSelect(null, stayCountChoices(8)).value).toBe('');
  });
});

describe('stayCountChoices — παράγεται από ταβάνι', () => {
  it('1..ceiling', () => {
    expect(stayCountChoices(4)).toEqual([1, 2, 3, 4]);
    expect(STAY_PET_CHOICES).toEqual([1, 2, 3, 4, 5]);
  });

  it('ταβάνι 0 ή αρνητικό ⇒ καμία επιλογή, ποτέ σφάλμα', () => {
    expect(stayCountChoices(0)).toEqual([]);
    expect(stayCountChoices(-3)).toEqual([]);
  });
});

/** ADR-777 §8.60.21.7 — ζωντανά 2026-09-22: «έως 2 κατοικίδια» πρόσφερε 1–5. */
describe('🔴 stayPetChoicesOf — ο επιλογέας σταματά στο όριο της αγγελίας', () => {
  it('δηλωμένο maxPets ⇒ 1..maxPets (όπως τα άτομα με το maxGuests)', () => {
    expect(stayPetChoicesOf({ accepts: 'yes', maxPets: 2, fee: null })).toEqual([1, 2]);
    expect(stayPetChoicesOf({ accepts: 'onRequest', maxPets: 1, fee: null })).toEqual([1]);
  });

  it('maxPets πάνω από το ταβάνι ⇒ το ταβάνι, ποτέ περισσότερα', () => {
    expect(stayPetChoicesOf({ accepts: 'yes', maxPets: 9, fee: null })).toEqual(STAY_PET_CHOICES);
  });

  it('⚠️ «όχι» · χωρίς όριο · αδήλωτο ⇒ το ταβάνι: την απάντηση τη δίνει ο κριτής, όχι άδεια λίστα', () => {
    expect(stayPetChoicesOf({ accepts: 'no' })).toEqual(STAY_PET_CHOICES);
    expect(stayPetChoicesOf({ accepts: 'yes', maxPets: null, fee: null })).toEqual(STAY_PET_CHOICES);
    expect(stayPetChoicesOf(null)).toEqual(STAY_PET_CHOICES);
    expect(stayPetChoicesOf(undefined)).toEqual(STAY_PET_CHOICES);
  });
});
