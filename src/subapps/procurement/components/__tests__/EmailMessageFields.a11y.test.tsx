/**
 * @file ADR-598 G11 · §3 procurement — `EmailMessageFields` (Θέμα + Κείμενο email).
 *
 * - Ε1: κάθε πεδίο ονομάζεται από την ετικέτα του — η σύνδεση γίνεται από το `FormField`.
 * - Ε2: οι αλλαγές φτάνουν στον γονέα· το `disabled` κλειδώνει και τα δύο.
 * - Α1: κανένα εύρημα axe.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { EmailMessageFields, type EmailMessageFieldsProps } from '../EmailMessageFields';

function renderFields(overrides: Partial<EmailMessageFieldsProps> = {}) {
  const props: EmailMessageFieldsProps = {
    subjectLabel: 'Θέμα',
    bodyLabel: 'Κείμενο',
    subject: 'Πρόσκληση',
    body: 'Καλησπέρα',
    onSubjectChange: jest.fn(),
    onBodyChange: jest.fn(),
    ...overrides,
  };
  render(<EmailMessageFields {...props} />);
  return props;
}

describe('EmailMessageFields', () => {
  it('Ε1: τα πεδία ονομάζονται από τις ετικέτες τους', () => {
    renderFields();
    expect(screen.getByRole('textbox', { name: 'Θέμα' })).toHaveValue('Πρόσκληση');
    expect(screen.getByRole('textbox', { name: 'Κείμενο' })).toHaveValue('Καλησπέρα');
  });

  it('Ε2: οι αλλαγές φτάνουν στον γονέα', () => {
    const props = renderFields();
    fireEvent.change(screen.getByRole('textbox', { name: 'Θέμα' }), { target: { value: 'Νέο' } });
    expect(props.onSubjectChange).toHaveBeenCalledWith('Νέο');
  });

  it('Ε2β: disabled ⇒ και τα δύο κλειδωμένα', () => {
    renderFields({ disabled: true });
    expect(screen.getByRole('textbox', { name: 'Θέμα' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Κείμενο' })).toBeDisabled();
  });

  it('Α1: κανένα εύρημα axe', async () => {
    renderFields();
    await expectNoA11yViolations(document.body);
  });
});
