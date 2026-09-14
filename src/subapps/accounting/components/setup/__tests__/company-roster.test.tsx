/**
 * @fileoverview Άγκυρες του **κοινού σκελετού σύνθεσης εταιρείας** — ADR-841 §7 Α23 (Φ2, N.0.2).
 * @related useRosterEditing.ts · ShareSumStatus.tsx · GemiNumberField.tsx
 *
 * 🔴 Τρεις ενότητες (ΟΕ · ΕΠΕ · ΑΕ) έγιναν καταναλωτές **ενός** σκελετού. Χωρίς άγκυρες η εξαγωγή
 * δεν αποδεικνύει ότι κράτησε τη συμπεριφορά: ανενεργοί εκτός αθροίσματος, ανοχή στρογγυλοποίησης,
 * σφάλμα αριθμού ΓΕΜΗ ανακοινώσιμο.
 */

import { act, render, renderHook, screen } from '@testing-library/react';
import React from 'react';

import { GemiNumberField } from '../GemiNumberField';
import { ShareSumStatus } from '../ShareSumStatus';
import { useRosterEditing } from '../useRosterEditing';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface Person {
  readonly id: string;
  readonly share: number;
  readonly isActive: boolean;
}

const createEmpty = (index: number): Person => ({ id: `new_${index}`, share: 0, isActive: true });
const shareOf = (person: Person): number => person.share;

describe('Ρ — useRosterEditing', () => {
  const PEOPLE: Person[] = [
    { id: 'a', share: 60, isActive: true },
    { id: 'b', share: 30, isActive: false },
    { id: 'c', share: 40, isActive: true },
  ];

  it('Ρ1 — 🔑 το άθροισμα αγνοεί τους ΑΝΕΝΕΡΓΟΥΣ', () => {
    const { result } = renderHook(() => useRosterEditing(PEOPLE, jest.fn(), createEmpty, shareOf));
    expect(result.current.activeShareSum).toBe(100);
  });

  it('Ρ2 — η αλλαγή συγχωνεύεται ΜΟΝΟ στη δική της θέση', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRosterEditing(PEOPLE, onChange, createEmpty, shareOf));
    act(() => result.current.change(1, { share: 10 }));
    expect(onChange).toHaveBeenCalledWith([PEOPLE[0], { ...PEOPLE[1], share: 10 }, PEOPLE[2]]);
  });

  it('Ρ3 — προσθήκη στο τέλος με δείκτη = πλήθος · αφαίρεση κατά θέση', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRosterEditing(PEOPLE, onChange, createEmpty, shareOf));
    act(() => result.current.add());
    expect(onChange).toHaveBeenLastCalledWith([...PEOPLE, createEmpty(3)]);
    act(() => result.current.remove(0));
    expect(onChange).toHaveBeenLastCalledWith([PEOPLE[1], PEOPLE[2]]);
  });
});

describe('Σ — ShareSumStatus', () => {
  it('Σ1 — 99,995% λόγω στρογγυλοποίησης ⇒ πλήρες, ανακοινώνεται ως status', () => {
    render(<ShareSumStatus sum={99.995} sumLabel="SUM" validLabel="OK" invalidLabel="BAD" />);
    expect(screen.getByRole('status').textContent).toBe('SUM — OK');
  });

  it('Σ2 — 90% ⇒ alert με το κείμενο της αποτυχίας', () => {
    render(<ShareSumStatus sum={90} sumLabel="SUM" validLabel="OK" invalidLabel="BAD" />);
    expect(screen.getByRole('alert').textContent).toBe('SUM — BAD');
  });
});

describe('Γ — GemiNumberField', () => {
  it('Γ1 — 🔴 σφάλμα ⇒ aria-invalid + role=alert δεμένο με aria-describedby', () => {
    render(<GemiNumberField id="gemi" value="12a" required={false} note="NOTE" error="ERR" onChange={jest.fn()} />);
    const input = screen.getByLabelText('setup.gemiNumber');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('gemi-note gemi-error');
    expect(screen.getByRole('alert').textContent).toBe('ERR');
  });

  it('Γ2 — υποχρεωτικό ⇒ αστερίσκος στην ετικέτα και required· χωρίς σφάλμα, κανένα aria-invalid', () => {
    render(<GemiNumberField id="gemi" value="" required onChange={jest.fn()} />);
    const input = screen.getByLabelText('setup.gemiNumber *') as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });
});
