/**
 * @jest-environment jsdom
 */

/**
 * ADR-923 §5.11 «3γ» 4δ — η γραμμή τιμολογίου αποθηκεύει **κωδικό** μονάδας, ποτέ μεταφρασμένη ετικέτα.
 * - Λ1: νέα γραμμή ⇒ `DEFAULT_UOM` (`'pcs'`) — παλιότερα `t('units.pieces')`: «τεμ» ή «pcs» ανάλογα με τη γλώσσα του χρήστη.
 * - Λ2: παλιά γραμμή με «τεμ» ⇒ ο επιλογέας τη διαβάζει ως `pcs` και έχει **όνομα πεδίου** από την ετικέτα της φόρμας.
 * - Λ3: επιλογή από τη λίστα ⇒ γράφεται ο κωδικός (`m2`), όχι η ετικέτα.
 * - Λ4: προκαθορισμένη υπηρεσία με παλιά γραφή («ώρες») ⇒ στη γραμμή φτάνει ο κανονικός κωδικός (`hr`).
 * - Λ8–Λ9 (ADR-ACC-003 §22.4): η νέα γραμμή ξεκινά από το καθεστώς ΦΠΑ της επιχείρησης.
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
import {
  companyLineVatDefault,
  type CompanyLineVatDefault,
} from '@/subapps/accounting/services/setup/company-vat-regime';

beforeAll(installPointerEvents);

const LEGACY_LINE: InvoiceLineItem = {
  lineNumber: 1, description: 'Μελέτη', quantity: 1, unit: 'τεμ', unitPrice: 100, vatRate: 24, netAmount: 100,
  mydataCode: 'category1_3',
};

const HOURLY_PRESET: ServicePreset = {
  presetId: 'sp_1', description: 'Επίβλεψη', unit: 'ώρες', unitPrice: 80, vatRate: 24, mydataCode: 'category1_3',
  isActive: true, sortOrder: 0,
};

function renderEditor(
  onChange = jest.fn(),
  presets: ServicePreset[] = [],
  lines: InvoiceLineItem[] = [LEGACY_LINE],
  lineVatDefault: CompanyLineVatDefault = companyLineVatDefault(null),
) {
  render(
    <LineItemsEditor
      lineItems={lines}
      onLineItemsChange={onChange}
      presets={presets}
      issueDate="2026-11-09"
      lineVatDefault={lineVatDefault}
    />,
  );
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

describe('LineItemsEditor — αιτία εξαίρεσης από την υπηρεσία (ADR-ACC-003 §22.3)', () => {
  const EXEMPT_PRESET: ServicePreset = { ...HOURLY_PRESET, vatRate: 0, vatExemptionCategory: 15 };
  const ZERO_LINE: InvoiceLineItem = { ...LEGACY_LINE, vatRate: 0, vatExemptionCategory: 7 };

  async function applyFirstPreset(presets: ServicePreset[], lines?: InvoiceLineItem[]) {
    const onChange = renderEditor(jest.fn(), presets, lines);
    await userEvent.setup().click(screen.getByRole('button', { name: 'preset' }));
    return (onChange.mock.calls[0][0] as InvoiceLineItem[])[0];
  }

  it('Λ5: υπηρεσία 0% με αιτία ⇒ η γραμμή την κληρονομεί, καθαρό από τον ένα υπολογισμό', async () => {
    const line = await applyFirstPreset([EXEMPT_PRESET]);
    expect(line).toMatchObject({ vatRate: 0, vatExemptionCategory: 15, unitPrice: 80, netAmount: 80 });
  });

  it('Λ6: υπηρεσία 0% ΧΩΡΙΣ αιτία δεν σβήνει αιτία που είχε ήδη η γραμμή', async () => {
    const line = await applyFirstPreset([{ ...EXEMPT_PRESET, vatExemptionCategory: null }], [ZERO_LINE]);
    expect(line.vatExemptionCategory).toBe(7);
  });

  it('Λ7: υπηρεσία 24% πάνω σε γραμμή 0% ⇒ η αιτία καθαρίζει', async () => {
    const line = await applyFirstPreset([HOURLY_PRESET], [ZERO_LINE]);
    expect(line).toMatchObject({ vatRate: 24, vatExemptionCategory: null });
  });
});

describe('LineItemsEditor — νέα γραμμή από το καθεστώς ΦΠΑ της επιχείρησης (ADR-ACC-003 §22.4)', () => {
  async function addLine(lineVatDefault: CompanyLineVatDefault) {
    const onChange = renderEditor(jest.fn(), [], [LEGACY_LINE], lineVatDefault);
    await userEvent.setup().click(screen.getByRole('button', { name: 'forms.addLineItem' }));
    return (onChange.mock.calls[0][0] as InvoiceLineItem[])[1];
  }

  it('Λ8: απαλλασσόμενη με κωδ. 15 ⇒ νέα γραμμή 0% + αιτία 15', async () => {
    const line = await addLine(companyLineVatDefault({ vatRegime: 'exempt', vatExemptionCategory: 15 }));
    expect(line).toMatchObject({ lineNumber: 2, vatRate: 0, vatExemptionCategory: 15 });
  });

  it('Λ9: κανονικό καθεστώς ⇒ νέα γραμμή 24%, χωρίς αιτία', async () => {
    const line = await addLine(companyLineVatDefault({ vatRegime: 'normal' }));
    expect(line).toMatchObject({ vatRate: 24, vatExemptionCategory: null });
  });
});
