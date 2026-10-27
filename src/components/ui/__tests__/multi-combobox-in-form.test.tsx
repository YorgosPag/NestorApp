/**
 * MultiCombobox ΜΕΣΑ σε `<form>` — με το ΠΡΑΓΜΑΤΙΚΟ Radix Checkbox (ADR-923 §5.11 «3γ», Βήμα 2).
 *
 * Μέσα σε φόρμα το Radix Checkbox αποδίδει κρυφό «bubble input» που, σε κάθε αλλαγή `checked`,
 * στέλνει ΣΥΝΘΕΤΙΚΟ `click` προς τα πάνω. Αν το φτάσει το `<li onClick>` της επιλογής, ξαναεναλλάσσει
 * ⇒ νέο click ⇒ … ⇒ «Maximum update depth exceeded» (μετρημένο ζωντανά στη φόρμα σύμβασης-πλαισίου).
 * Η σουίτα `multi-combobox.test.tsx` κάνει mock το Checkbox — γι' αυτό ήταν τυφλή σε αυτό.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MultiCombobox } from '../multi-combobox';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const OPTIONS = [
  { value: 'p1', label: 'ΕΡΓΟ Α' },
  { value: 'p2', label: 'ΕΡΓΟ Β' },
];

function Harness({ onChange }: { readonly onChange: (values: string[]) => void }) {
  const [value, setValue] = React.useState<string[]>([]);
  return (
    <form>
      <MultiCombobox
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        options={OPTIONS}
        ariaLabel="projects"
      />
    </form>
  );
}

function openList(): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'projects' }));
}

describe('MultiCombobox μέσα σε <form> (πραγματικό Checkbox)', () => {
  it('κλικ στη γραμμή ⇒ ΜΙΑ εναλλαγή, κανένας βρόχος', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    openList();
    fireEvent.click(screen.getByText('ΕΡΓΟ Α', { selector: 'li span' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(['p1']);
  });

  it('κλικ πάνω στο ίδιο το κουτάκι ⇒ ΜΙΑ εναλλαγή (όχι δύο που αναιρούν η μία την άλλη)', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    openList();
    const option = screen.getAllByRole('option')[1];
    const box = option.querySelector('button');
    if (!box) throw new Error('checkbox button missing');
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(['p2']);
  });
});
