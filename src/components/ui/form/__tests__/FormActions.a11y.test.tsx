/**
 * @file ADR-598 G11 · §3 procurement — το συμβόλαιο του `FormActions`.
 *
 * - Φ1: το κουμπί υποβολής **ανήκει** στη φόρμα μέσω `form=` (είναι το προεπιλεγμένο
 *       κουμπί της κατά την HTML) — άρα Enter και κλικ περνούν από ΕΝΑ `onSubmit`.
 * - Φ2: όσο τρέχει η υποβολή: κείμενο αναμονής, και τα δύο κουμπιά απενεργοποιημένα.
 * - Φ3: το σφάλμα ανακοινώνεται (`role="alert"`).
 * - Φ4: χωρίς `onCancel` ⇒ κανένα κουμπί Άκυρο.
 * - Α1: κανένα εύρημα axe.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { defaultSubmitButton } from '@/test-utils/implicit-submission';
import { FormActions, type FormActionsProps } from '../FormActions';

const FORM_ID = 'f';

function renderWithForm(props: Partial<FormActionsProps> = {}, onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault())) {
  render(
    <>
      <form id={FORM_ID} onSubmit={onSubmit} aria-label="φόρμα">
        <input aria-label="πεδίο" />
      </form>
      <FormActions
        formId={FORM_ID}
        submitLabel="Αποθήκευση"
        pendingLabel="Αποθήκευση…"
        cancelLabel="Ακύρωση"
        onCancel={() => undefined}
        submitting={false}
        {...props}
      />
    </>,
  );
  return onSubmit;
}

describe('FormActions', () => {
  it('Φ1: το κουμπί είναι το προεπιλεγμένο κουμπί της φόρμας (form=) και την υποβάλλει', () => {
    const onSubmit = renderWithForm();
    const form = screen.getByRole('form', { name: 'φόρμα' }) as HTMLFormElement;
    expect(defaultSubmitButton(form)).toBe(screen.getByRole('button', { name: 'Αποθήκευση' }));
    fireEvent.click(screen.getByRole('button', { name: 'Αποθήκευση' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Φ2: σε αναμονή ⇒ κείμενο αναμονής, κουμπιά κλειδωμένα', () => {
    renderWithForm({ submitting: true });
    expect(screen.getByRole('button', { name: 'Αποθήκευση…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ακύρωση' })).toBeDisabled();
  });

  it('Φ3: σφάλμα ⇒ role="alert"', () => {
    renderWithForm({ error: 'Η αποθήκευση απέτυχε' });
    expect(screen.getByRole('alert')).toHaveTextContent('Η αποθήκευση απέτυχε');
  });

  it('Φ4: χωρίς onCancel ⇒ κανένα Άκυρο', () => {
    renderWithForm({ onCancel: undefined });
    expect(screen.queryByRole('button', { name: 'Ακύρωση' })).toBeNull();
  });

  it('Α1: κανένα εύρημα axe (και με σφάλμα)', async () => {
    renderWithForm({ error: 'x' });
    await expectNoA11yViolations(document.body);
  });
});
