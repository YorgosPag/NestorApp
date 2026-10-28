/**
 * @jest-environment jsdom
 */

/**
 * ADR-923 §5.11 «3γ» 4γ — ο ΕΝΑΣ επιλογέας μονάδας.
 * - Υ1: μονάδα με συντομογραφία ⇒ «όνομα (σύμβολο)»· μονάδα-λέξη του μητρώου (`spelledOut`) ⇒ **μόνο το όνομα**
 *   (όχι «Σακί (σακιά)» — το «σύμβολο» της είναι το πληθυντικό, όχι συντομογραφία).
 * - Υ2: το `id` φτάνει στο πεδίο ⇒ το `<Label htmlFor>` της φόρμας του δίνει όνομα.
 * - Υ3: `compact` σε μισή στήλη φόρμας (υλικό BIM — ζωντανά το «Τετραγωνικό…» κοβόταν) ⇒ σύμβολο ορατό, όνομα μονάδας ως
 *   `sr-only` τιμή, και **κανένα** `aria-label` που θα έκρυβε την ετικέτα της φόρμας.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));

import { installPointerEvents } from '@/test-utils/pointer-event';
import { UomSelect } from '../UomSelect';

beforeAll(installPointerEvents);

describe('UomSelect', () => {
  it('Υ1: συντομογραφία ⇒ «όνομα (σύμβολο)» · μονάδα-λέξη ⇒ μόνο όνομα', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<UomSelect value="m2" units={['m2', 'bag', 'set']} onValueChange={jest.fn()} />);
    await user.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['name.m2 (symbol.m2)', 'name.bag', 'name.set']);
  });

  it('Υ2: το id συνδέει την ετικέτα της φόρμας', () => {
    render(
      <>
        <label htmlFor="material-unit">Μονάδα</label>
        <UomSelect id="material-unit" value="pcs" units={['pcs']} onValueChange={jest.fn()} />
      </>,
    );
    expect(screen.getByRole('combobox', { name: 'Μονάδα' })).toBeTruthy();
  });

  it('Υ3: compact σε φόρμα ⇒ όνομα πεδίου = η ετικέτα (όχι η τιμή), σύμβολο ορατό, όνομα μονάδας ως sr-only τιμή', () => {
    render(
      <label>
        <span>Μονάδα</span>
        <UomSelect value="m2" units={['m2']} onValueChange={jest.fn()} compact />
      </label>,
    );
    const trigger = screen.getByRole('combobox', { name: /^Μονάδα/ });
    expect(trigger).not.toHaveAttribute('aria-label');
    expect(within(trigger).getByText('symbol.m2')).toHaveAttribute('aria-hidden', 'true');
    expect(within(trigger).getByText('name.m2')).toHaveClass('sr-only');
  });
});
