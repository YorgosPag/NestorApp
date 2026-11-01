/**
 * Οι οθόνες τιμής προμηθευτή αποδίδονται πραγματικά (ADR-923 §5.12 τμήμα 4): ό,τι θα έσπαγε μόνο στον φυλλομετρητή.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockSupplyView = jest.fn();
jest.mock('@/hooks/catalog/useSupplyViews', () => ({ useBuyerSupplyView: () => mockSupplyView() }));

const mockReview = jest.fn();
const mockApply = jest.fn();
jest.mock('@/services/catalog/supply-api.client', () => ({
  reviewSupplierLines: (...args: unknown[]) => mockReview(...args),
  applySupplierPriceToLine: (...args: unknown[]) => mockApply(...args),
  searchForeignSkus: jest.fn(),
  quoteForeignSku: jest.fn(),
}));

jest.mock('@/components/catalog/shared/catalog-neutral-hooks', () => ({ useCatalogAccess: () => 'granted' }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const mockError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: mockError }) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι οθόνες */
import type { BOQItem, BoqSupplierPriceSource } from '@/types/boq';
import { BOQSupplierLinkedSource } from '../BOQSupplierLinkedSource';
import { BOQSupplierPriceField } from '../BOQSupplierPriceField';
import { BOQSupplierPriceReviewPanel } from '../BOQSupplierPriceReviewPanel';
import { createInitialState } from '../useBOQEditorState';
/* eslint-enable import/first */

const SOURCE = {
  authority: 'supplier', supplierCompanyId: 'comp_s', variantId: 'cprod_1', audience: null, discountSteps: [], priceListId: 'l', priceListVersionId: 'v', versionNumber: 3,
  lineId: 'x', subjectKey: 's', unit: 'pcs', priceQuantity: 10, breakdown: { material: 10000, labor: 0, equipment: 0 }, defaultWasteBp: 0, appliedAt: 'T1', appliedBy: 'u',
} as BoqSupplierPriceSource;

const ITEM = {
  id: 'boq_1', title: 'Γραμμή', status: 'draft', scope: 'building', unit: 'pcs', categoryCode: 'OIK-1', estimatedQuantity: 10, wasteFactor: 0, wastePolicy: 'inherited',
  materialUnitCost: 10, laborUnitCost: 0, equipmentUnitCost: 0, actualQuantity: null, priceSource: SOURCE,
} as unknown as BOQItem;

const common = { colors: { text: { muted: 'muted' } }, t: (key: string) => key } as unknown as React.ComponentProps<typeof BOQSupplierPriceField>;
const PRICE = { priceListId: 'l', priceListVersionId: 'v2', lineId: 'y', subjectKey: 's', unitCode: 'pcs', quantity: 10, netAmount: 20000, discountSteps: [], audience: null };
const CHANGED = { boqItemId: 'boq_1', relationshipId: 'srel_1', variantId: 'cprod_1', drift: { kind: 'changed', price: PRICE, changeBp: 10000, exceedsFence: true } };
const relationships = (rows: readonly unknown[]) => mockSupplyView.mockReturnValue({ current: { state: 'ready', view: { relationships: rows } } });
const KEY = 'tabs.measurements.editor.priceSource.supplier';

beforeEach(() => {
  mockSupplyView.mockReset();
  mockReview.mockReset();
  mockApply.mockReset();
  mockError.mockReset();
});

describe('BOQSupplierPriceField', () => {
  const field = (item: BOQItem | null) => render(<BOQSupplierPriceField {...common} form={createInitialState(item, 'OIK-1', 'p')} item={item} onApplied={jest.fn()} />);

  it('χωρίς ενεργό προμηθευτή δεν εμφανίζεται τίποτα', () => {
    relationships([{ id: 'srel_1', state: 'ended', supplierName: 'Α' }]);
    expect(field(ITEM).container.textContent).toBe('');
  });

  it('🔴 νέα γραμμή ⇒ λέει γιατί δεν ανοίγει', () => {
    relationships([{ id: 'srel_1', state: 'active', supplierName: 'Α' }]);
    field(null);
    expect(screen.getByText(`${KEY}.gate.unsaved`)).toBeTruthy();
  });

  it('αποθηκευμένη πρόχειρη ⇒ ο επιλογέας, και η προειδοποίηση ότι η εφαρμογή ισχύει αμέσως', () => {
    relationships([{ id: 'srel_1', state: 'active', supplierName: 'Α' }]);
    field(ITEM);
    expect(screen.getByText(`${KEY}.label`)).toBeTruthy();
    expect(screen.getByText(`${KEY}.immediate`)).toBeTruthy();
  });
});

describe('BOQSupplierLinkedSource', () => {
  const linked = (onApplied = jest.fn()) => render(
    <BOQSupplierLinkedSource {...common} source={SOURCE} item={ITEM} onApplied={onApplied} onDetach={jest.fn()} />,
  );

  it('🔴 Σ7: μη διαθέσιμη πηγή ⇒ χωρίς κουμπί ανανέωσης', async () => {
    mockReview.mockResolvedValue([{ ...CHANGED, drift: { kind: 'unavailable' } }]);
    linked();
    await screen.findByText(`${KEY}.notices.unavailable`);
    expect(screen.queryByText(`${KEY}.refresh`)).toBeNull();
  });

  it('🔴 πάνω από τον φράχτη ⇒ το κουμπί μένει κλειστό ως τη ρητή επιβεβαίωση', async () => {
    mockReview.mockResolvedValue([CHANGED]);
    mockApply.mockResolvedValue({ kind: 'applied', source: SOURCE });
    const onApplied = jest.fn();
    linked(onApplied);
    const button = (await screen.findByText(`${KEY}.refresh`)).closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(button.disabled).toBe(false));
    await act(async () => { fireEvent.click(button); });
    expect(mockApply.mock.calls[0][1]).toMatchObject({ confirmFence: true, acknowledged: { netAmount: 20000, quantity: 10 } });
    expect(onApplied).toHaveBeenCalledWith(SOURCE);
  });

  it('🔴 `priceMoved` ⇒ ξαναρωτά, αντί να μείνει η παλιά τιμή στην οθόνη', async () => {
    mockReview.mockResolvedValue([{ ...CHANGED, drift: { ...CHANGED.drift, exceedsFence: false } }]);
    mockApply.mockResolvedValue({ kind: 'priceMoved', price: PRICE });
    linked();
    const button = await screen.findByText(`${KEY}.refresh`);
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => expect(mockReview).toHaveBeenCalledTimes(2));
  });
});

describe('BOQSupplierPriceReviewPanel', () => {
  it('🔴 γραμμή πάνω από τον φράχτη δεν εφαρμόζεται χωρίς επιβεβαίωση, και αποτυχία ⇒ ονομασμένο μήνυμα', async () => {
    mockReview.mockResolvedValue([CHANGED]);
    mockApply.mockResolvedValue({ kind: 'priceMoved', price: PRICE });
    const onApplied = jest.fn();
    render(<BOQSupplierPriceReviewPanel items={[ITEM]} onApplied={onApplied} />);
    await screen.findByText('tabs.measurements.priceReview.supplier.summary');
    const apply = screen.getByText('tabs.measurements.priceReview.apply').closest('button') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(apply.disabled).toBe(false));
    await act(async () => { fireEvent.click(apply); });
    expect(mockApply.mock.calls[0][1]).toMatchObject({ confirmFence: true });
    expect(mockError).toHaveBeenCalledWith('tabs.measurements.priceReview.supplier.partial');
    expect(onApplied).toHaveBeenCalled();
  });

  it('τίποτα προς έλεγχο ⇒ τίποτα στην οθόνη', async () => {
    mockReview.mockResolvedValue([{ ...CHANGED, drift: { kind: 'current' } }]);
    const { container } = render(<BOQSupplierPriceReviewPanel items={[ITEM]} onApplied={jest.fn()} />);
    await waitFor(() => expect(mockReview).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
