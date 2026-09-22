/**
 * @file ADR-598 «(θ)» — SSoT `FormDialog`: ο διάλογος που ΕΙΝΑΙ φόρμα.
 *
 * - Φ1: το κουμπί του υποσέλιδου (έξω από το `<form>`) υποβάλλει τη φόρμα· Enter = ίδιος δρόμος.
 * - Φ2: όσο τρέχει η υποβολή, Esc / «Άκυρο» ΔΕΝ κλείνουν τον διάλογο· μετά, ναι.
 * - Φ3: σφάλμα εκτός υποβολής (`error`) υπερισχύει και ανακοινώνεται (`role="alert"`).
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { pressEnterToSubmit } from '@/test-utils/implicit-submission';
import { FormDialog } from '../FormDialog';

function Harness({ submitting = false, onOpenChange = jest.fn(), onSubmit = jest.fn(), error }: {
  submitting?: boolean; onOpenChange?: jest.Mock; onSubmit?: jest.Mock; error?: string | null;
}) {
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Τίτλος"
      description="Περιγραφή"
      submission={{ submitting, error: 'σφάλμα υποβολής', handleSubmit: async (e) => { e?.preventDefault(); onSubmit(); } }}
      error={error}
      submitLabel="Αποθήκευση"
      pendingLabel="Αποθήκευση…"
      cancelLabel="Άκυρο"
    >
      <label htmlFor="name">Όνομα</label>
      <input id="name" />
    </FormDialog>
  );
}

describe('FormDialog', () => {
  it('Φ1: κλικ στο υποσέλιδο ΚΑΙ Enter υποβάλλουν την ίδια φόρμα', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }));
    act(() => { pressEnterToSubmit(screen.getByLabelText('Όνομα') as HTMLInputElement); });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('Φ2: όσο υποβάλλεται, Esc και «Άκυρο» ΔΕΝ κλείνουν· αλλιώς κλείνουν', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(<Harness submitting onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Άκυρο' })).toBeDisabled();
    expect(onOpenChange).not.toHaveBeenCalled();

    rerender(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Άκυρο' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Φ3: το `error` υπερισχύει του σφάλματος υποβολής', () => {
    const { rerender } = render(<Harness />);
    expect(screen.getByRole('alert')).toHaveTextContent('σφάλμα υποβολής');
    rerender(<Harness error="σφάλμα βήματος" />);
    expect(screen.getByRole('alert')).toHaveTextContent('σφάλμα βήματος');
  });
});
