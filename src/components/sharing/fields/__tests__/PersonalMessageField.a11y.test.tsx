/**
 * @file ADR-312 §9.6 · ADR-327 §7.5 — `PersonalMessageField`.
 *
 * - Ε1: το πεδίο ονομάζεται από την ετικέτα του και περιγράφεται από τον μετρητή (πριν ήταν ασύνδετα).
 * - Ε2: το όριο ισχύει και στο πληκτρολόγιο (`maxLength`) και στην επικόλληση (`slice`).
 * - Α1: κανένα εύρημα axe.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { MAX_PERSONAL_MESSAGE_LENGTH } from '@/config/personal-message-policy';
import { expectNoA11yViolations } from '@/test-utils/a11y';
import { PersonalMessageField } from '../PersonalMessageField';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, options?: { count?: number }) => (options?.count !== undefined ? `${key}:${options.count}` : key) }),
}));

describe('PersonalMessageField', () => {
  it('Ε1: named by its label and described by the counter', () => {
    render(<PersonalMessageField value="Γεια" onChange={jest.fn()} />);
    const field = screen.getByRole('textbox', { name: /personalMessage\.label/ });
    expect(field).toHaveValue('Γεια');
    expect(field).toHaveAccessibleDescription(`personalMessage.charsRemaining:${MAX_PERSONAL_MESSAGE_LENGTH - 4}`);
  });

  it('Ε2: the limit holds for typing and for paste', () => {
    const onChange = jest.fn();
    render(<PersonalMessageField value="" onChange={onChange} />);
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('maxLength', String(MAX_PERSONAL_MESSAGE_LENGTH));
    fireEvent.change(field, { target: { value: 'x'.repeat(MAX_PERSONAL_MESSAGE_LENGTH + 10) } });
    expect(onChange).toHaveBeenCalledWith('x'.repeat(MAX_PERSONAL_MESSAGE_LENGTH));
  });

  it('Α1: no axe violations', async () => {
    const { container } = render(<PersonalMessageField value="" onChange={jest.fn()} />);
    await expectNoA11yViolations(container);
  });
});
