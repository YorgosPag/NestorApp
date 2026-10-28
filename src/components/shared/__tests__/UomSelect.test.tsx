/**
 * @jest-environment jsdom
 */

/**
 * ADR-923 §5.11 «3γ» 4γ — ο ΕΝΑΣ επιλογέας μονάδας.
 * - Υ1: μονάδα με συντομογραφία ⇒ «όνομα (σύμβολο)»· μονάδα-λέξη του μητρώου (`spelledOut`) ⇒ **μόνο το όνομα**
 *   (όχι «Σακί (σακιά)» — το «σύμβολο» της είναι το πληθυντικό, όχι συντομογραφία).
 * - Υ2: το `id` φτάνει στο πεδίο ⇒ το `<Label htmlFor>` της φόρμας του δίνει όνομα.
 */

import { render, screen } from '@testing-library/react';
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
});
