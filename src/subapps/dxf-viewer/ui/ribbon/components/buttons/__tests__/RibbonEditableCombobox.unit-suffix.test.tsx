/**
 * ADR-677 Φάση 2γ — η ένδειξη μονάδας μέσα στο αριθμητικό combobox.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: μέχρι τη Φάση 2β η μονάδα ζούσε στην ετικέτα («Πλάτος (mm)»). Όταν τα πεδία
 * άρχισαν να δείχνουν μέτρα, η ετικέτα έγινε ψέμα — και σκέτο «0.900» χωρίς καμία ένδειξη θα
 * ήταν χειρότερο από το ψέμα. Εδώ κατοχυρώνεται ότι το σύμβολο εμφανίζεται εκεί που πρέπει,
 * ΔΕΝ εμφανίζεται εκεί που δεν πρέπει, και φτάνει στην υποστηρικτική τεχνολογία.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RibbonEditableCombobox } from '../RibbonEditableCombobox';
import type { RibbonCommand } from '../../../types/ribbon-types';

// Το `useSemanticColors` τραβά ολόκληρο το theme context· εδώ μας ενδιαφέρει μόνο η διάταξη.
jest.mock('@/hooks/useSemanticColors', () => ({
  useSemanticColors: () => ({ bg: { primary: 'bg-primary' } }),
}));

const command: RibbonCommand = {
  id: 'opening.width',
  labelKey: 'ribbon.commands.openingEditor.width',
  commandKey: 'opening.width',
};

const config = { allowNegative: false, allowDecimal: true };

function renderField(props: Partial<React.ComponentProps<typeof RibbonEditableCombobox>> = {}) {
  return render(
    <RibbonEditableCombobox
      command={command}
      options={[{ value: '0.900', labelKey: '0.900', isLiteralLabel: true }]}
      value="0.900"
      disabled={false}
      config={config}
      ariaLabel="Πλάτος"
      widthPx={140}
      onCommit={jest.fn()}
      {...props}
    />,
  );
}

describe('ADR-677 Φάση 2γ — ένδειξη μονάδας', () => {
  it('δείχνει το σύμβολο της ενεργής μονάδας δίπλα στον αριθμό', () => {
    renderField({ unitSuffix: 'm' });
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('η μονάδα φτάνει και στο accessible name — όχι μόνο στα μάτια', () => {
    // Το ορατό σύμβολο είναι `aria-hidden`· χωρίς αυτό, ένας χρήστης screen reader θα άκουγε
    // «Πλάτος 0.900» και δεν θα μάθαινε ποτέ ότι πρόκειται για μέτρα.
    renderField({ unitSuffix: 'm' });
    expect(screen.getByRole('textbox', { name: 'Πλάτος (m)' })).toBeInTheDocument();
  });

  it('ΔΕΝ δείχνει σύμβολο σε πεδίο χωρίς μονάδα (πλήθος, DN)', () => {
    renderField({ unitSuffix: undefined, value: '16' });
    expect(screen.queryByText('m')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Πλάτος' })).toBeInTheDocument();
  });

  it('ΔΕΝ δείχνει σύμβολο σε μεικτή επιλογή — το «—» δεν είναι ποσότητα', () => {
    renderField({ unitSuffix: 'm', value: null });
    expect(screen.queryByText('m')).not.toBeInTheDocument();
  });

  it('τα presets του dropdown κουβαλούν κι αυτά τη μονάδα', async () => {
    // Μια λίστα «0.900 / 1.000» χωρίς μονάδα διαβάζεται το ίδιο άσχημα με το πεδίο.
    renderField({ unitSuffix: 'm' });
    await userEvent.click(screen.getByRole('button', { name: 'Πλάτος' }));
    expect(await screen.findByText('0.900 m')).toBeInTheDocument();
  });
});
