/**
 * @fileoverview ΑΓΚΥΡΑ — **το πατημένο κουμπί** (ADR-770 §19): `ToggleButton` · `SegmentedControl` · `Toggle`.
 *
 *   Π1 · ToggleButton: `aria-pressed` + `data-state` από ΜΙΑ πηγή· ρόλος χειριστηρίου, ποτέ `bg-primary`.
 *   Π2 · ToggleButton `semantics="selected"`: `aria-selected`, ΚΑΝΕΝΑ `aria-pressed` (απαγορευμένο σε `role="tab"`).
 *   Π3 · ο ρόλος νικά τα χειρόγραφα χρώματα του καταναλωτή (η σειρά στο `cn`).
 *   Π4 · SegmentedControl: radio σημασιολογία, ονομασμένη ομάδα, βελάκια μετακινούν την εστίαση.
 *   Π5 · SegmentedControl: ΔΕΝ αδειάζει ποτέ (το Radix `single` θα αποεπέλεγε).
 *   Π5β · SegmentedControl `vertical`: η ΔΙΑΤΑΞΗ λίστας ζει στο SSoT (ADR-809 §9.5), και τα βελάκια ↑/↓.
 *   Π6 · Toggle (Radix): ON = ρόλος, όχι `bg-accent`.
 */

import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ToggleButton } from '../toggle-button';
import { SegmentedControl, SegmentedControlItem } from '../segmented-control';
import { Toggle } from '../toggle';

describe('ToggleButton', () => {
  it('Π1 · aria-pressed + data-state, ρόλος χειριστηρίου — όχι bg-primary', () => {
    const { rerender } = render(<ToggleButton pressed>Φίλτρα</ToggleButton>);
    const button = screen.getByRole('button', { name: 'Φίλτρα' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-state', 'on');
    expect(button).toHaveClass('bg-control-accent', 'text-control-accent-foreground', 'border-control-accent');
    expect(button).not.toHaveClass('bg-primary');

    rerender(<ToggleButton pressed={false}>Φίλτρα</ToggleButton>);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('data-state', 'off');
    expect(button).not.toHaveClass('bg-control-accent');
  });

  it('Π2 · semantics="selected" ⇒ aria-selected, κανένα aria-pressed', () => {
    render(
      <ToggleButton pressed semantics="selected" role="tab">
        Αρχεία
      </ToggleButton>,
    );
    const tab = screen.getByRole('tab', { name: 'Αρχεία' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).not.toHaveAttribute('aria-pressed');
  });

  it('Π2β · semantics="checked" (role="radio") ⇒ aria-checked, κανένα aria-pressed', () => {
    render(
      <ToggleButton pressed={false} semantics="checked" role="radio">
        Ράβδοι
      </ToggleButton>,
    );
    const radio = screen.getByRole('radio', { name: 'Ράβδοι' });
    expect(radio).toHaveAttribute('aria-checked', 'false');
    expect(radio).not.toHaveAttribute('aria-pressed');
  });

  it('Π3 · ο ρόλος νικά χειρόγραφο bg-primary του καταναλωτή', () => {
    render(
      <ToggleButton pressed className="bg-primary text-primary-foreground">
        Πλέγμα
      </ToggleButton>,
    );
    const button = screen.getByRole('button', { name: 'Πλέγμα' });
    expect(button).toHaveClass('bg-control-accent');
    expect(button).not.toHaveClass('bg-primary');
  });
});

type View = 'cards' | 'table';

function Harness({ onChange }: { readonly onChange?: (v: View) => void }) {
  const [view, setView] = useState<View>('cards');
  return (
    <SegmentedControl<View>
      value={view}
      onValueChange={(v) => {
        onChange?.(v);
        setView(v);
      }}
      aria-label="Προβολή"
    >
      <SegmentedControlItem value="cards">Κάρτες</SegmentedControlItem>
      <SegmentedControlItem value="table">Πίνακας</SegmentedControlItem>
    </SegmentedControl>
  );
}

describe('SegmentedControl', () => {
  it('Π4 · ονομασμένη ομάδα, radio, επιλογή με κλικ, βελάκι μετακινεί την εστίαση', async () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Προβολή' })).toBeInTheDocument();
    const cards = screen.getByRole('radio', { name: 'Κάρτες' });
    const table = screen.getByRole('radio', { name: 'Πίνακας' });
    expect(cards).toHaveAttribute('aria-checked', 'true');
    expect(cards).toHaveClass('data-[state=on]:bg-control-accent');

    fireEvent.click(table);
    expect(table).toHaveAttribute('aria-checked', 'true');
    expect(cards).toHaveAttribute('aria-checked', 'false');

    table.focus();
    fireEvent.keyDown(table, { key: 'ArrowLeft' });
    // Το Radix RovingFocus εστιάζει σε επόμενο tick.
    await waitFor(() => expect(cards).toHaveFocus());
  });

  it('Π5 · κλικ στο ήδη επιλεγμένο ⇒ μένει επιλεγμένο, ο καταναλωτής ΔΕΝ ακούει κενό', () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    const cards = screen.getByRole('radio', { name: 'Κάρτες' });
    fireEvent.click(cards);
    expect(cards).toHaveAttribute('aria-checked', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SegmentedControl — orientation="vertical" (ADR-809 §9.5 · CHECK 3.94)', () => {
  it('Π5β · λίστα πλήρους πλάτους από το SSoT, ετικέτες αριστερά, ↓ μετακινεί την εστίαση', async () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε τον κλάδο `vertical` από το `segmented-control` ⇒ κοκκινίζει. Χωρίς αυτόν
    //    κάθε καταναλωτής ξαναγράφει κλάσεις διάταξης — και οι 3 στήλες ξαναέκοβαν το «Σύστημα» στα 320 px.
    render(
      <SegmentedControl<View> orientation="vertical" value="cards" onValueChange={() => undefined} aria-label="Θέμα">
        <SegmentedControlItem value="cards">Κάρτες</SegmentedControlItem>
        <SegmentedControlItem value="table">Πίνακας</SegmentedControlItem>
      </SegmentedControl>,
    );
    const group = screen.getByRole('group', { name: 'Θέμα' });
    expect(group).toHaveClass('flex-col', 'w-full', 'items-stretch');
    expect(group).not.toHaveClass('inline-flex');
    const cards = screen.getByRole('radio', { name: 'Κάρτες' });
    expect(cards).toHaveAttribute('data-orientation', 'vertical');
    expect(cards).toHaveClass('data-[orientation=vertical]:justify-start');

    cards.focus();
    fireEvent.keyDown(cards, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Πίνακας' })).toHaveFocus());
  });

  it('Π5γ · η προεπιλογή (οριζόντια) ΔΕΝ άλλαξε — 5 καταναλωτές τη χρησιμοποιούν', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Προβολή' })).toHaveClass('inline-flex', 'flex-wrap');
  });
});

describe('Toggle (Radix)', () => {
  it('Π6 · ON = ρόλος χειριστηρίου, όχι bg-accent (§17.6 #1 έκλεισε)', () => {
    render(<Toggle pressed aria-label="Έντονα" />);
    const toggle = screen.getByRole('button', { name: 'Έντονα' });
    expect(toggle).toHaveAttribute('data-state', 'on');
    expect(toggle).toHaveClass('data-[state=on]:bg-control-accent');
    expect(toggle).not.toHaveClass('data-[state=on]:bg-accent');
  });
});
