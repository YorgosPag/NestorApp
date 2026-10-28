/**
 * @file ADR-923 §5.11 «3γ» Α10 — η γραμμή παραγγελίας στον ζωντανό έλεγχο.
 *
 * - Μ1: παλιά γραφή `'τεμ'` ⇒ το κλειστό πεδίο δείχνει το **σύμβολο** του κανονικού κωδικού (`symbol.pcs`), το όνομα είναι
 *   `sr-only` **τιμή**, και το πεδίο ονομάζεται από τη **στήλη** (`items.unit`) — ποτέ από την τιμή (WAI-ARIA).
 * - Μ2: η τιμή του Select είναι ο **κανονικός** κωδικός — αλλιώς το `'τεμ'` γίνεται δεύτερο «Τεμάχιο» εκτός λίστας και κανένα
 *   από τα δύο δεν είναι το επιλεγμένο της λίστας (η ρίζα της «κενής» μονάδας του ζωντανού ελέγχου).
 * - Μ3: άγνωστη αποθηκευμένη γραφή μένει ορατή επιλογή (ο επιλογέας είναι πλέον το κοινό `UomSelect`, 4γ).
 * - Α1: η τιμή `500` εμφανίζεται **ολόκληρη** σε πεδίο κειμένου (`NumericField`, ADR-706) — όχι σε `type="number"`, του
 *   οποίου τα βελάκια έκοβαν το «500» σε «50» στο κελί των 54px.
 * - Α2: «12,5» ⇒ `unitPrice: 12.5` (ελληνικό κόμμα)· Α3: μηδέν ⇒ κενό πεδίο.
 */

import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));

import { installPointerEvents } from '@/test-utils/pointer-event';
import { PurchaseOrderItemsTable } from '../PurchaseOrderItemsTable';

beforeAll(installPointerEvents);

type Props = React.ComponentProps<typeof PurchaseOrderItemsTable>;
type Item = Props['items'][number];

function line(overrides: Partial<Item> = {}): Item {
  return {
    tempId: 't1',
    description: 'Καλώδιο',
    quantity: 1,
    unit: 'τεμ',
    unitPrice: 500,
    boqItemId: null,
    categoryCode: 'OIK-9',
    materialId: null,
    ...overrides,
  };
}

function renderTable(items: Item[], onUpdateItem: Props['onUpdateItem'] = jest.fn()) {
  return render(
    <PurchaseOrderItemsTable items={items} onUpdateItem={onUpdateItem} onAddItem={jest.fn()} onRemoveItem={jest.fn()} />,
  );
}

/** Ο πίνακας (desktop) είναι το πρώτο αντίγραφο· η κάρτα κινητού το δεύτερο — ίδιο component, ίδια συμπεριφορά. */
const priceFields = (): HTMLInputElement[] => screen.getAllByLabelText<HTMLInputElement>('items.unitPrice');

describe('PurchaseOrderItemsTable — μονάδα και αριθμητικά πεδία', () => {
  it('Μ1: παλιά γραφή «τεμ» ⇒ σύμβολο ορατό, όνομα ως τιμή για αναγνώστη οθόνης, πεδίο με όνομα της στήλης', () => {
    renderTable([line()]);
    const triggers = screen.getAllByRole('combobox', { name: 'items.unit' });
    expect(triggers.length).toBeGreaterThan(0);
    for (const trigger of triggers) {
      expect(within(trigger).getByText('symbol.pcs')).toHaveAttribute('aria-hidden', 'true');
      expect(within(trigger).getByText('name.pcs')).toHaveClass('sr-only');
    }
  });

  it('Μ2: «τεμ» στη λίστα ⇒ ΕΝΑ «Τεμάχιο», επιλεγμένο (όχι δεύτερη επιλογή «εκτός λίστας»)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTable([line()]);
    await user.click(screen.getAllByRole('combobox', { name: 'items.unit' })[0]);

    const pcs = await screen.findAllByRole('option', { name: 'name.pcs (symbol.pcs)' });
    expect(pcs).toHaveLength(1);
    expect(pcs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('Μ3: άγνωστη αποθηκευμένη μονάδα ⇒ μένει ορατή και επιλεγμένη (ποτέ σιωπηλό κενό)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderTable([line({ unit: 'καρότσι' })]);
    const [trigger] = screen.getAllByRole('combobox', { name: 'items.unit' });
    expect(within(trigger).getByText('καρότσι', { selector: '[aria-hidden="true"]' })).toBeTruthy();
    await user.click(trigger);

    const offList = await screen.findByRole('option', { name: 'καρότσι' });
    expect(offList).toHaveAttribute('aria-selected', 'true');
  });

  it('Α1: η τιμή 500 εμφανίζεται ολόκληρη, σε πεδίο κειμένου', () => {
    renderTable([line()]);
    for (const field of priceFields()) {
      expect(field).toHaveValue('500');
      expect(field).toHaveAttribute('type', 'text');
      expect(field).toHaveAttribute('inputmode', 'decimal');
    }
  });

  it('Α2: «12,5» ⇒ unitPrice 12.5', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onUpdateItem = jest.fn();
    renderTable([line({ unitPrice: 0 })], onUpdateItem);

    const [price] = priceFields();
    await user.type(price, '12,5');
    await user.tab();

    expect(onUpdateItem).toHaveBeenLastCalledWith('t1', { unitPrice: 12.5 });
  });

  it('Α3: μηδενική τιμή ⇒ κενό πεδίο (όχι «0»)', () => {
    renderTable([line({ unitPrice: 0, quantity: 0 })]);
    for (const field of priceFields()) expect(field).toHaveValue('');
    for (const field of screen.getAllByLabelText<HTMLInputElement>('items.quantity')) expect(field).toHaveValue('');
  });
});
