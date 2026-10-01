/**
 * @fileoverview Άγκυρες ADR-896 §8 — τσιπ γρήγορων ειδικοτήτων: ΕΝΑ φίλτρο με το dropdown,
 * ειλικρίνεια στο μηδέν, «άγνωστο ≠ μηδέν».
 * @related components/mandate/OccupationQuickFilters.tsx · OccupationSelect.tsx · useOccupationFamilyChoices.ts
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { OCCUPATION_FAMILIES, type OccupationFamilyId } from '@/config/occupation-families';
import type { OccupationFamilyTallies } from '@/lib/agency/occupation-family-tallies';
import { familyToken } from '@/lib/agency/occupation-query';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    i18n: { language: 'el' },
    t: jest.requireActual('@/lib/agency/__fixtures__/el-translate').elTranslate,
  }),
}));

/** Το combobox μοκάρεται ώστε να δούμε **τι του δίνεται** — τιμή και επιλογές. */
const comboProps: { value?: string; options?: readonly ComboboxOption[] } = {};
jest.mock('@/components/ui/searchable-combobox', () => ({
  SearchableCombobox: (props: { value: string; options: readonly ComboboxOption[] }) => {
    comboProps.value = props.value;
    comboProps.options = props.options;
    return <span />;
  },
}));

import { OccupationQuickFilters } from '../OccupationQuickFilters';
import { OccupationSelect } from '../OccupationSelect';
import { useOccupationFamilyChoices } from '../useOccupationFamilyChoices';

function tallies(overrides: Partial<Record<OccupationFamilyId, number>>): OccupationFamilyTallies {
  return new Map(OCCUPATION_FAMILIES.map((family) => [family.id, overrides[family.id] ?? 0]));
}

function Harness({
  value,
  counts,
  onChange,
}: {
  readonly value: string | null;
  readonly counts: OccupationFamilyTallies | null;
  readonly onChange: (next: string | null) => void;
}): React.ReactElement {
  const families = useOccupationFamilyChoices(counts);
  return (
    <>
      <p id="scope-hint">hint</p>
      <OccupationQuickFilters value={value} choices={families} emptyHintId="scope-hint" onChange={onChange} />
      <OccupationSelect value={value} options={[]} locale="el" families={families} onChange={onChange} />
    </>
  );
}

function chip(name: RegExp): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('ADR-896 §8 — τσιπ γρήγορων ειδικοτήτων', () => {
  it('Κ1: η λέξη είναι ορατή, το πλήθος στο όνομα, δύο ομάδες με τίτλο', () => {
    render(<Harness value={null} counts={tallies({ plumber: 3 })} onChange={jest.fn()} />);
    const plumber = chip(/^Υδραυλικός/);
    expect(plumber).toHaveTextContent('Υδραυλικός');
    expect(plumber).toHaveAccessibleName('Υδραυλικός 3 επαγγελματίες');
    expect(plumber).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('group', { name: 'Μηχανικοί' })).toBeInTheDocument();
    const trades = screen.getByRole('group', { name: 'Συνεργεία' });
    // Τα τσιπ (toggle, `aria-pressed`) — όχι τα βελάκια της λωρίδας (§7Α.5).
    expect(within(trades).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))).toHaveLength(11);
  });

  it('Κ2: πάτημα γράφει `family:<id>` — η ΙΔΙΑ τιμή που δείχνει το dropdown', () => {
    const onChange = jest.fn();
    const { rerender } = render(<Harness value={null} counts={tallies({ plumber: 3 })} onChange={onChange} />);
    fireEvent.click(chip(/^Υδραυλικός/));
    expect(onChange).toHaveBeenCalledWith(familyToken('plumber'));

    rerender(<Harness value={familyToken('plumber')} counts={tallies({ plumber: 3 })} onChange={onChange} />);
    expect(chip(/^Υδραυλικός/)).toHaveAttribute('aria-pressed', 'true');
    expect(comboProps.value).toBe(familyToken('plumber'));
    expect(comboProps.options?.some((option) => option.value === familyToken('plumber'))).toBe(true);
  });

  it('Κ3: ξαναπάτημα του ενεργού = καθαρισμός (null)', () => {
    const onChange = jest.fn();
    render(<Harness value={familyToken('plumber')} counts={tallies({ plumber: 3 })} onChange={onChange} />);
    fireEvent.click(chip(/^Υδραυλικός/));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('Κ4: μηδέν = ορατό, aria-disabled, εξηγείται — και δεν γράφει τίποτα', () => {
    const onChange = jest.fn();
    render(<Harness value={null} counts={tallies({})} onChange={onChange} />);
    const roofer = chip(/^Στέγες/);
    expect(roofer).toHaveAttribute('aria-disabled', 'true');
    expect(roofer).toHaveAttribute('aria-describedby', 'scope-hint');
    expect(roofer).toHaveAccessibleName('Στέγες κανείς ακόμη');
    fireEvent.click(roofer);
    expect(onChange).not.toHaveBeenCalled();
    const option = comboProps.options?.find((o) => o.value === familyToken('roofer'));
    expect(option).toMatchObject({ disabled: true, disabledHint: 'κανείς ακόμη' });
  });

  it('Κ5: πατημένο ΚΑΙ μηδέν (π.χ. μετά από αλλαγή περιοχής) μένει ενεργό, για να καθαρίζει', () => {
    const onChange = jest.fn();
    render(<Harness value={familyToken('roofer')} counts={tallies({})} onChange={onChange} />);
    const roofer = chip(/^Στέγες/);
    expect(roofer).not.toHaveAttribute('aria-disabled');
    fireEvent.click(roofer);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('Κ6: άγνωστο ≠ μηδέν — χωρίς πλήθη, κανένας αριθμός και κανένα αχνό τσιπ', () => {
    render(<Harness value={null} counts={null} onChange={jest.fn()} />);
    const roofer = chip(/^Στέγες/);
    expect(roofer).toHaveAccessibleName('Στέγες');
    expect(roofer).not.toHaveAttribute('aria-disabled');
  });

  it('Κ7: ακριβής ειδικότητα από το dropdown ⇒ κανένα τσιπ πατημένο', () => {
    render(
      <Harness
        value="http://data.europa.eu/esco/occupation/ed3cf43d-c2c1-4c46-82fc-1375e27e0290"
        counts={tallies({ plumber: 3 })}
        onChange={jest.fn()}
      />,
    );
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  /**
   * Κ8 (ADR-896 §7Α.5): **ΜΙΑ γραμμή ανά ομάδα, σε κάθε πλάτος** — κάθε ομάδα έχει ΜΙΑ λίστα μέσα σε
   * `ScrollRail`, και καμία κλάση `md:` δεν την ξανακάνει αναδίπλωση/στήλη. Τα βελάκια έχουν όνομα
   * από το i18n και μένουν εκτός σειράς Tab (το πληκτρολόγιο φτάνει κάθε τσιπ μόνο του).
   */
  it('Κ8: κάθε ομάδα = μία λωρίδα κύλισης, χωρίς αναδίπλωση σε κανένα πλάτος', () => {
    const { container } = render(<Harness value={null} counts={tallies({ plumber: 3 })} onChange={jest.fn()} />);
    for (const name of ['Μηχανικοί', 'Συνεργεία']) {
      const group = screen.getByRole('group', { name });
      const lists = within(group).getAllByRole('list');
      expect(lists).toHaveLength(1);
      expect(lists[0]).toHaveAttribute('data-scroll-edges');
      expect(within(group).getByRole('button', { name: 'Επόμενες ειδικότητες' })).toHaveAttribute('tabindex', '-1');
      expect(within(group).getByRole('button', { name: 'Προηγούμενες ειδικότητες' })).toHaveAttribute('tabindex', '-1');
    }
    expect(container.querySelector('[class*="md:flex-wrap"], [class*="md:flex-col"]')).toBeNull();
  });
});
