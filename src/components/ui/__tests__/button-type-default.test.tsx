/**
 * @file ADR-598 «(η)» — το `Button` του έργου είναι κουμπί ΕΝΕΡΓΕΙΑΣ εξ ορισμού, όχι ΥΠΟΒΟΛΗΣ.
 *
 * Η HTML κάνει κάθε `<button>` χωρίς `type` κουμπί υποβολής μέσα σε `<form>` — άρα ένα
 * «Προσθήκη γραμμής» υπέβαλλε τη φόρμα, και το Enter σε πεδίο πατούσε **αυτό** (πρώτο
 * κουμπί υποβολής κατά σειρά εγγράφου), όχι το «Αποθήκευση». Προεπιλογή `button` όπως
 * MUI ButtonBase / React Aria `useButton`.
 *
 * Τι κλειδώνει:
 * - Τ1: χωρίς `type` ⇒ `type="button"`, το κλικ ΔΕΝ υποβάλλει.
 * - Τ2: ρητό `submit` / `reset` ⇒ σεβαστό (η υποβολή γίνεται μόνο όταν δηλωθεί).
 * - Τ3: implicit submission — το προεπιλεγμένο κουμπί της φόρμας είναι το `submit`, ΟΧΙ το
 *   πρώτο κουμπί ενέργειας που προηγείται στο DOM.
 * - Τ4: `asChild` ⇒ δεν επιβάλλουμε `type` στο στοιχείο του παιδιού (`<a>` δεν έχει `type`).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '@/components/ui/button';
import { defaultSubmitButton } from '@/test-utils/implicit-submission';

function renderInForm(children: React.ReactNode) {
  const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
  const view = render(
    <form aria-label="φόρμα" onSubmit={onSubmit}>
      <input aria-label="πεδίο" />
      {children}
    </form>,
  );
  return { ...view, onSubmit, form: screen.getByRole('form') as HTMLFormElement };
}

describe('Button — προεπιλεγμένο type', () => {
  test('Τ1: χωρίς type ⇒ type="button" και το κλικ ΔΕΝ υποβάλλει τη φόρμα', async () => {
    const onClick = jest.fn();
    const { onSubmit } = renderInForm(<Button onClick={onClick}>Προσθήκη γραμμής</Button>);
    const button = screen.getByRole('button', { name: 'Προσθήκη γραμμής' });

    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('Τ2α: ρητό type="submit" ⇒ το κλικ υποβάλλει', async () => {
    const { onSubmit } = renderInForm(<Button type="submit">Αποθήκευση</Button>);
    const button = screen.getByRole('button', { name: 'Αποθήκευση' });

    expect(button).toHaveAttribute('type', 'submit');
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('Τ2β: ρητό type="reset" ⇒ σεβαστό', () => {
    renderInForm(<Button type="reset">Καθαρισμός</Button>);
    expect(screen.getByRole('button', { name: 'Καθαρισμός' })).toHaveAttribute('type', 'reset');
  });

  test('Τ3: το προεπιλεγμένο κουμπί της φόρμας είναι το submit, όχι το πρώτο κουμπί ενέργειας', () => {
    const { form } = renderInForm(
      <>
        <Button>Προσθήκη γραμμής</Button>
        <Button type="submit">Αποθήκευση</Button>
      </>,
    );
    expect(defaultSubmitButton(form)).toBe(screen.getByRole('button', { name: 'Αποθήκευση' }));
  });

  test('Τ4: asChild ⇒ κανένα type στο στοιχείο του παιδιού', () => {
    render(
      <Button asChild>
        <a href="/x">Σύνδεσμος</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Σύνδεσμος' })).not.toHaveAttribute('type');
  });
});
