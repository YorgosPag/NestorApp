/**
 * @jest-environment jsdom
 */

/**
 * ADR-923 §5.11 «3γ» 4δ — η γραμμή τιμολογίου αποθηκεύει **κωδικό** μονάδας, ποτέ μεταφρασμένη ετικέτα.
 * - Λ1: νέα γραμμή ⇒ `DEFAULT_UOM` (`'pcs'`) — παλιότερα `t('units.pieces')`: «τεμ» ή «pcs» ανάλογα με τη γλώσσα του χρήστη.
 * - Λ2: παλιά γραμμή με «τεμ» ⇒ ο επιλογέας τη διαβάζει ως `pcs` και έχει **όνομα πεδίου** από την ετικέτα της φόρμας.
 * - Λ3: επιλογή από τη λίστα ⇒ γράφεται ο κωδικός (`m2`), όχι η ετικέτα.
 * - Λ4: προκαθορισμένη υπηρεσία με παλιά γραφή («ώρες») ⇒ στη γραμμή φτάνει ο κανονικός κωδικός (`hr`).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InvoiceLineItem, ServicePreset } from '@/subapps/accounting/types';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));
jest.mock('../../../shared/VATRateSelector', () => ({ VATRateSelector: () => null }));
jest.mock('../../../shared/ServicePresetCombobox', () => ({
  ServicePresetCombobox: ({ presets, onPresetSelect }: {
    presets: ServicePreset[];
    onPresetSelect: (preset: ServicePreset) => void;
  }) => <button type="button" onClick={() => onPresetSelect(presets[0])}>preset</button>,
}));

import { installPointerEvents } from '@/test-utils/pointer-event';
import { LineItemsEditor } from '../LineItemsEditor';

beforeAll(installPointerEvents);

const LEGACY_LINE: InvoiceLineItem = {
  lineNumber: 1, description: 'Μελέτη', quantity: 1, unit: 'τεμ', unitPrice: 100, vatRate: 24, netAmount: 100,
  mydataCode: 'category1_3',
};

const HOURLY_PRESET: ServicePreset = {
  presetId: 'sp_1', description: 'Επίβλεψη', unit: 'ώρες', unitPrice: 80, vatRate: 24, mydataCode: 'category1_3',
  isActive: true, sortOrder: 0,
};

function renderEditor(onChange = jest.fn(), presets: ServicePreset[] = []) {
  render(<LineItemsEditor lineItems={[LEGACY_LINE]} onLineItemsChange={onChange} presets={presets} />);
  return onChange;
}

describe('LineItemsEditor — μονάδα ως κωδικός του μητρώου', () => {
  it('Λ1: νέα γραμμή ⇒ DEFAULT_UOM', async () => {
    const onChange = renderEditor();
    await userEvent.setup().click(screen.getByRole('button', { name: 'forms.addLineItem' }));
    const [, added] = onChange.mock.calls[0][0] as InvoiceLineItem[];
    expect(added.unit).toBe('pcs');
  });

  it('Λ2: παλιό «τεμ» ⇒ επιλεγμένο pcs, πεδίο με όνομα από την ετικέτα', () => {
    renderEditor();
    expect(screen.getByRole('combobox', { name: 'forms.unit' }).textContent).toContain('name.pcs');
  });

  it('Λ3: επιλογή ⇒ αποθηκεύεται ο κωδικός', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = renderEditor();
    await user.click(screen.getByRole('combobox', { name: 'forms.unit' }));
    await user.click(await screen.findByRole('option', { name: 'name.m2 (symbol.m2)' }));
    expect((onChange.mock.calls[0][0] as InvoiceLineItem[])[0].unit).toBe('m2');
  });

  it('Λ4: προκαθορισμένη υπηρεσία με παλιά γραφή ⇒ κανονικός κωδικός', async () => {
    const onChange = renderEditor(jest.fn(), [HOURLY_PRESET]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'preset' }));
    expect((onChange.mock.calls[0][0] as InvoiceLineItem[])[0].unit).toBe('hr');
  });
});
