/**
 * **Οι γραμμές χωρίς πεδίο είναι ενεργές** (ADR-923 §5.5.2 Β3 Γ8): κατάσταση με λέξη, τρεις ενέργειες, αναίρεση, άρνηση με λόγο,
 * εστίαση στο PDF. Η απόφαση φεύγει με το σταθερό κλειδί `(page, table, line)`.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineOverride, ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { markBundlesComplete } from '@/test-utils/i18n-mock';
import { ProposalUnmappedLines } from '../ProposalUnmappedLines';
import type { LineActivity } from '../use-line-decisions';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('../../shared/catalog-ui-hooks', () => ({ useCatalogCanManage: () => true }));
jest.mock('../import-surfaces', () => ({
  LineAttributeToolsSlot: ({ mode }: { readonly mode: string }) => <p>{`tools:${mode}`}</p>,
  PriceLineDialogSlot: ({ onDecide }: { readonly onDecide: (unitCode: string) => void }) => <button type="button" onClick={() => onDecide('m')}>price-dialog</button>,
}));

const LINE: ImportPageUnmappedLine = { page: 87, table: 't0', line: 9, label: 'ΠΑΡΟΧΗ ΑΕΡΑ · Μ · m³/h', values: ['280', '340'], regions: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.01 }] };

const proposal = (overrides: Partial<ImportProposalWire> = {}): ImportProposalWire => ({
  id: 'cipsl_1', companyId: 'c', revision: 3, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null,
  batchId: 'b', groupKey: 'page:87:t0', purpose: 'attributes', status: 'pending', familyId: 'f', variantSchemeCode: 's', modelCode: 'mfp', priceListVersionId: null, pages: [87],
  extracted: { groupKey: 'page:87:t0', modelCode: 'mfp', sharedCells: [], rows: [], pages: [87] }, rows: [], violations: [], appliedAt: null, appliedBy: null,
  ...overrides,
});

const ignored: ImportLineOverride = { page: 87, table: 't0', line: 9, decision: { kind: 'ignore' }, by: 'u', at: '' };

interface SetupOptions {
  readonly overrides?: readonly ImportLineOverride[];
  readonly activity?: ReadonlyMap<string, LineActivity>;
  readonly value?: ImportProposalWire;
  readonly pricesEnabled?: boolean;
}

function setup(options: SetupOptions = {}) {
  const handlers = { onFocusLine: jest.fn(), onDecideLine: jest.fn() };
  const value = options.value ?? proposal();
  render(
    <ProposalUnmappedLines proposal={value} lines={[LINE]} overrides={options.overrides} activity={options.activity ?? new Map()} activeLine={null}
      decidable={value.status === 'pending'} pricesEnabled={options.pricesEnabled} {...handlers} />,
  );
  return handlers;
}

const KEY = lineKeyOf(LINE);

beforeAll(() => markBundlesComplete(['catalog', 'catalog-import']));

describe('§5.5.2 Β3 — γραμμές χωρίς πεδίο', () => {
  it('δείχνει ετικέτα, τιμές και «Εκκρεμεί» με λέξη', () => {
    setup();
    expect(screen.getByText(LINE.label)).toBeTruthy();
    expect(screen.getByText('280 · 340')).toBeTruthy();
    expect(screen.getByText('review.lines.statePending')).toBeTruthy();
  });

  it('🔴 «Αγνόηση» στέλνει απόφαση με το κλειδί της γραμμής, χωρίς δέσιμο', () => {
    const { onDecideLine } = setup();
    fireEvent.click(screen.getByRole('button', { name: /review\.lines\.ignore/ }));
    expect(onDecideLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'cipsl_1' }), { page: 87, table: 't0', line: 9, decision: { kind: 'ignore' }, bind: null });
  });

  it('αγνοημένη γραμμή: «Αγνοήθηκε» και «Αναίρεση» που στέλνει `null`', () => {
    const { onDecideLine } = setup({ overrides: [ignored] });
    expect(screen.getByText('review.lines.stateIgnored')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /review\.lines\.undo/ }));
    expect(onDecideLine).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ decision: null }));
  });

  it('άρνηση: ο λόγος φαίνεται δίπλα στη γραμμή', () => {
    setup({ activity: new Map([[KEY, { kind: 'refused', reason: 'readingVision' }]]) });
    expect(screen.getByText('review.lines.stateRefused')).toBeTruthy();
    expect(screen.getByText('review.lines.refusalReadingVision')).toBeTruthy();
  });

  it('όσο ξαναερμηνεύεται, οι ενέργειες κλειδώνουν', () => {
    setup({ activity: new Map([[KEY, { kind: 'saving' }]]) });
    expect(screen.getByText('review.lines.stateSaving')).toBeTruthy();
    expect((screen.getByRole('button', { name: /review\.lines\.ignore/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('πρόταση που έκλεισε: καμία ενέργεια', () => {
    setup({ value: proposal({ status: 'applied' }) });
    expect((screen.getByRole('button', { name: /review\.lines\.map/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('το κλικ στην ετικέτα εστιάζει τη γραμμή στο PDF', () => {
    const { onFocusLine } = setup();
    fireEvent.click(screen.getByRole('button', { name: /review\.lines\.show/ }));
    expect(onFocusLine).toHaveBeenCalledWith(LINE);
  });

  it('«Αντιστοίχιση» και «Νέα ιδιότητα» ανοίγουν τα εργαλεία της γραμμής', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /review\.lines\.newAttribute/ }));
    expect(screen.getByText('tools:new')).toBeTruthy();
  });
});

describe('§5.5.2 Β4 — η γραμμή τιμής', () => {
  const PRICE_ACTION = { name: /review\.priceLine\.action/ };

  it('🔴 χωρίς τιμοκατάλογο ή δικαίωμα τιμολόγησης: κανένα κουμπί «Τιμή»', () => {
    setup();
    expect(screen.queryByRole('button', PRICE_ACTION)).toBeNull();
  });

  it('🔴 «Τιμή» ⇒ διάλογος μονάδας ⇒ απόφαση `price` με τη μονάδα που δηλώθηκε, με το κλειδί της γραμμής', () => {
    const { onDecideLine } = setup({ pricesEnabled: true });
    fireEvent.click(screen.getByRole('button', PRICE_ACTION));
    fireEvent.click(screen.getByRole('button', { name: 'price-dialog' }));
    expect(onDecideLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'cipsl_1' }), { page: 87, table: 't0', line: 9, decision: { kind: 'price', unitCode: 'm' }, bind: null });
  });

  it('γραμμή τιμής: λογίζεται αποφασισμένη, με «Αναίρεση» που στέλνει `null`', () => {
    const priced: ImportLineOverride = { ...ignored, decision: { kind: 'price', unitCode: 'pcs' } };
    const { onDecideLine } = setup({ overrides: [priced], pricesEnabled: true });
    expect(screen.getByText('review.lines.stateMapped')).toBeTruthy();
    expect(screen.queryByRole('button', PRICE_ACTION)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /review\.lines\.undo/ }));
    expect(onDecideLine).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ decision: null }));
  });

  it('πρόταση που έκλεισε: το «Τιμή» κλειδώνει', () => {
    setup({ value: proposal({ status: 'applied' }), pricesEnabled: true });
    expect((screen.getByRole('button', PRICE_ACTION) as HTMLButtonElement).disabled).toBe(true);
  });
});
