/**
 * **Ο έλεγχος πρότασης αποδίδει ό,τι είπε ο διακομιστής** (ADR-923 §5.5): η έγκριση κλειδώνει όσο υπάρχει πεδίο σε εκκρεμότητα,
 * οι αποφάσεις φεύγουν με το σταθερό κλειδί του στόχου, το κλικ εστιάζει το πεδίο για το PDF, και το εφαρμοσμένο δεν αλλάζει.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { ProposalReview } from '../ProposalReview';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/catalog/useCatalogCollection', () => ({
  useCatalogCollection: () => ({ items: [{ id: 'cattr_power', code: 'power', labels: { el: 'Ισχύς' } }] }),
}));

const target = { kind: 'attribute', attributeId: 'cattr_power', channel: ANY_SLOT, locale: ANY_SLOT } as const;

const field = (overrides: Partial<ImportProposalField> = {}): ImportProposalField => ({
  target,
  sourceText: '1,8 kW',
  incoming: { type: 'measurement', amount: '1.8', unitCode: 'kW' },
  live: null,
  base: null,
  status: 'new',
  confidence: 0.95,
  anchor: { kind: 'page', page: 60, regions: [{ x: 0.1, y: 0.2, width: 0.1, height: 0.01 }], verified: true },
  issues: [],
  decision: 'accept',
  ...overrides,
});

const row = (fields: readonly ImportProposalField[], overrides: Partial<ImportProposalRow> = {}): ImportProposalRow => ({
  rowKey: 'r0', holderKind: 'product', holderId: null, expectedRevision: null, action: 'create', label: '099-01-001', fields, issues: [], ...overrides,
});

const proposal = (rows: readonly ImportProposalRow[], overrides: Partial<ImportProposalWire> = {}): ImportProposalWire => ({
  id: 'cipsl_1', companyId: 'c', revision: 3, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null,
  batchId: 'b', groupKey: 'g', purpose: 'attributes', status: 'pending', familyId: 'f', variantSchemeCode: 's', modelCode: 'mfp', priceListVersionId: null, pages: [60],
  extracted: { groupKey: 'g', modelCode: 'mfp', sharedCells: [], rows: [], pages: [60] }, rows, violations: [], appliedAt: null, appliedBy: null,
  ...overrides,
});

function setup(value: ImportProposalWire) {
  const handlers = { onFocus: jest.fn(), onChange: jest.fn(), onApply: jest.fn(), onReject: jest.fn() };
  render(<ProposalReview proposal={value} focused={null} {...handlers} />);
  return handlers;
}

describe('ProposalReview', () => {
  it('όλα αποφασισμένα: η έγκριση στέλνει την πρόταση', () => {
    const value = proposal([row([field()])]);
    const { onApply } = setup(value);
    fireEvent.click(screen.getByRole('button', { name: 'review.apply' }));
    expect(onApply).toHaveBeenCalledWith(value);
  });

  it('πεδίο σε εκκρεμότητα: η έγκριση κλειδώνει και το λέει', () => {
    setup(proposal([row([field({ decision: 'pending' })])]));
    expect(screen.getByRole('button', { name: 'review.apply' })).toBeDisabled();
    expect(screen.getByText('review.pending')).toBeInTheDocument();
  });

  it('η απόφαση φεύγει με το σταθερό κλειδί του στόχου, όχι με θέση', () => {
    const value = proposal([row([field({ decision: 'pending' })])]);
    const { onChange } = setup(value);
    fireEvent.click(screen.getByRole('button', { name: 'review.accept' }));
    expect(onChange).toHaveBeenCalledWith(value, { decisions: [{ rowKey: 'r0', targetKey: importTargetKey(target), decision: 'accept' }] });
  });

  it('τιμή που δεν διαβάστηκε δεν γίνεται αποδεκτή, και η μαζική αποδοχή την προσπερνά', () => {
    const unread = field({ incoming: null, decision: 'pending', issues: [{ code: 'misaligned', path: 'cattr_power' }] });
    const value = proposal([row([unread])]);
    const { onChange } = setup(value);
    expect(screen.getByRole('button', { name: 'review.accept' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'review.acceptRow' }));
    expect(onChange).toHaveBeenCalledWith(value, { decisions: [] });
    expect(screen.getByRole('alert')).toHaveTextContent('issues.misaligned');
  });

  it('το κλικ στο πεδίο το εστιάζει, με την άγκυρά του για το PDF', () => {
    const value = field();
    const { onFocus } = setup(proposal([row([value])]));
    fireEvent.click(screen.getByRole('button', { name: 'Ισχύς' }));
    expect(onFocus).toHaveBeenCalledWith(value);
  });

  it('η διόρθωση στέλνει το νέο κείμενο της πηγής, μόνο αν άλλαξε', () => {
    const value = proposal([row([field()])]);
    const { onChange } = setup(value);
    fireEvent.click(screen.getByRole('button', { name: '1.8 kW' }));
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '1.8 kW' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '2,7 kW' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onChange).toHaveBeenCalledWith(value, { edits: [{ rowKey: 'r0', targetKey: importTargetKey(target), text: '2,7 kW' }] });
  });

  it('ό,τι δεν διασταυρώθηκε με το κείμενο της σελίδας το λέει δίπλα στη βεβαιότητα', () => {
    setup(proposal([row([field({ confidence: 0.6, anchor: { kind: 'page', page: 60, regions: [], verified: false } })])]));
    expect(screen.getByText(/60%.*review\.unverified/)).toBeInTheDocument();
  });

  it('εφαρμοσμένη πρόταση: καμία πράξη, κανένα κουμπί έγκρισης', () => {
    setup(proposal([row([field()])], { status: 'applied' }));
    expect(screen.queryByRole('button', { name: 'review.apply' })).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: '099-01-001' });
    expect(within(section).getByRole('button', { name: 'review.reject' })).toBeDisabled();
  });

  it('χωρίς κωδικό μοντέλου ζητά τον κωδικό, και τον στέλνει', () => {
    const value = proposal([row([field()])], { modelCode: null });
    const { onChange } = setup(value);
    fireEvent.change(screen.getByLabelText('review.modelCode'), { target: { value: 'mfp' } });
    fireEvent.click(screen.getByRole('button', { name: 'review.setModelCode' }));
    expect(onChange).toHaveBeenCalledWith(value, { modelCode: 'mfp' });
  });
});
