/**
 * **Ο έλεγχος πρότασης αποδίδει ό,τι είπε ο διακομιστής** (ADR-923 §5.5): η έγκριση κλειδώνει όσο υπάρχει πεδίο σε εκκρεμότητα,
 * οι αποφάσεις φεύγουν με το σταθερό κλειδί του στόχου, το κλικ επιλέγει το πεδίο στον έναν κάτοχο (§5.5.2 Β8), και το εφαρμοσμένο
 * δεν αλλάζει.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ImportProposalField, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { ProposalReview } from '../ProposalReview';
import { fieldTargetOf, reviewTargetKey } from '../review-overlay-model';
import { markBundlesComplete } from '@/test-utils/i18n-mock';

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

function setup(value: ImportProposalWire, batchOpen = true, selectedKey: string | null = null) {
  const handlers = { onSelect: jest.fn(), onChange: jest.fn(), onApply: jest.fn(), onReject: jest.fn() };
  render(<ProposalReview proposal={value} selectedKey={selectedKey} batchOpen={batchOpen} {...handlers} />);
  return handlers;
}

// ADR-744 §34: τα ευρήματα θέλουν πίνακα ΚΑΙ πλήρες bundle — εδώ ο hook μετάφρασης είναι mock, άρα το δηλώνουμε.
beforeAll(() => markBundlesComplete(['catalog', 'catalog-import']));

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
    fireEvent.click(screen.getByRole('radio', { name: 'review.accept' }));
    expect(onChange).toHaveBeenCalledWith(value, { decisions: [{ rowKey: 'r0', targetKey: importTargetKey(target), decision: 'accept' }] });
  });

  it('τιμή που δεν διαβάστηκε δεν γίνεται αποδεκτή, και η μαζική αποδοχή την προσπερνά', async () => {
    const unread = field({ incoming: null, decision: 'pending', issues: [{ code: 'misaligned', path: 'cattr_power' }] });
    const value = proposal([row([unread])]);
    const { onChange } = setup(value);
    expect(screen.getByRole('radio', { name: 'review.accept' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'review.acceptRow' }));
    expect(onChange).toHaveBeenCalledWith(value, { decisions: [] });
    // ADR-744 §34: πρώτα η λέξη αναμονής, μετά το ακριβές μήνυμα — ποτέ ωμό κλειδί ενδιάμεσα.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('issues.misaligned'));
  });

  it('το κλικ στο πεδίο το επιλέγει στον έναν κάτοχο, με σταθερό στόχο (όχι αντικείμενο)', () => {
    const { onSelect } = setup(proposal([row([field()])]));
    fireEvent.click(screen.getByRole('button', { name: 'Ισχύς' }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'field', proposalId: 'cipsl_1', rowKey: 'r0', targetKey: importTargetKey(target) });
  });

  it('§5.5.2 Β8: η επιλογή επιβιώνει ξαναφόρτωμα — ίδιο κλειδί, ΝΕΑ αντικείμενα ⇒ ενεργό πεδίο', () => {
    const fresh = proposal([row([field()])]);
    const key = reviewTargetKey(fieldTargetOf('cipsl_1', fresh.rows[0], fresh.rows[0].fields[0]));
    setup(proposal([row([field()])]), true, key);
    expect(screen.getByRole('button', { name: 'Ισχύς' })).toHaveAttribute('aria-current', 'true');
  });

  it('§5.5.2 Β8: πεδίο που κρύβει η προβολή αλλά επιλέχτηκε στο PDF φαίνεται, με σημείωση — το φίλτρο δεν αλλάζει', () => {
    // Ένα σε εκκρεμότητα ⇒ αρχική προβολή «Θέλουν απόφαση», που κρύβει το αποδεκτό «Ισχύς».
    const accepted = field();
    const pending = field({ target: { ...target, attributeId: 'cattr_other' }, decision: 'pending' });
    const value = proposal([row([accepted, pending])]);
    const key = reviewTargetKey(fieldTargetOf('cipsl_1', value.rows[0], accepted));
    setup(value, true, key);
    expect(screen.getByRole('button', { name: 'Ισχύς' })).toBeInTheDocument();
    expect(screen.getByText('review.overlay.revealed')).toBeInTheDocument();
  });

  it('§5.5.2 Β8: χωρίς επιλογή, η προβολή κρύβει ό,τι κρύβει — καμία σημείωση', () => {
    const value = proposal([row([field(), field({ target: { ...target, attributeId: 'cattr_other' }, decision: 'pending' })])]);
    setup(value);
    expect(screen.queryByRole('button', { name: 'Ισχύς' })).not.toBeInTheDocument();
    expect(screen.queryByText('review.overlay.revealed')).not.toBeInTheDocument();
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
    expect(within(section).getByRole('radio', { name: 'review.reject' })).toBeDisabled();
  });

  // §5.5.2 Α2: η επιλογή είναι κατάσταση radio, όχι χρώμα — ο αναγνώστης οθόνης ακούει ποια είναι πατημένη.
  it('η απόφαση διαβάζεται ως επιλεγμένο radio, και ξαναζήτηση της ίδιας δεν στέλνει τίποτα', () => {
    const value = proposal([row([field({ decision: 'accept' })])]);
    const { onChange } = setup(value);
    expect(screen.getByRole('radio', { name: 'review.accept' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'review.reject' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: 'review.accept' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  // §5.5.2 Α1: η «αυτόματη αποδοχή» είναι δηλωμένη από τον διακομιστή· πρόταση χωρίς προέλευση = κανόνας.
  it('ποιος αποφάσισε: κανόνας ⇒ «αυτόματα», άνθρωπος ⇒ «δική σας»', () => {
    setup(proposal([row([field({ decisionBy: 'rule' }), field({ target: { ...target, attributeId: 'cattr_other' }, decisionBy: 'human' })])]));
    expect(screen.getByText('review.decisionAuto')).toBeInTheDocument();
    expect(screen.getByText('review.decisionHuman')).toBeInTheDocument();
  });

  it('εκκρεμότητα: καμία επιλογή πατημένη, και το λέει η λέξη', () => {
    setup(proposal([row([field({ decision: 'pending' })])]));
    expect(screen.getByText('review.decisionPending')).toBeInTheDocument();
    // Μόνο η ομάδα απόφασης του πεδίου: το φίλτρο προβολής της σύνοψης (Β2) είναι κι αυτό radio, με επιλογή πάντα.
    const decision = screen.getByRole('group', { name: 'review.decisionFor' });
    for (const radio of within(decision).getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false');
  });

  // §5.5.2 Α3: το αμετάβλητο αποθηκεύεται `reject`, αλλά δεν δείχνεται ως «Απόρριψη».
  it('αμετάβλητο: κανένα κουμπί απόφασης, «τίποτα να εφαρμοστεί»', () => {
    setup(proposal([row([field({ status: 'unchanged', decision: 'reject' })])]));
    expect(screen.getByText('review.nothingToApply')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'review.decisionFor' })).not.toBeInTheDocument();
  });

  it('σε αποθήκευση: το λέει δίπλα στην έγκριση', () => {
    const handlers = { onSelect: jest.fn(), onChange: jest.fn(), onApply: jest.fn(), onReject: jest.fn() };
    render(<ProposalReview proposal={proposal([row([field()])])} selectedKey={null} saving batchOpen {...handlers} />);
    expect(screen.getByText('review.saving')).toBeInTheDocument();
  });

  // ADR-934 Ε3: εκκρεμής πρόταση σε εγκαταλειμμένη/κλειστή παρτίδα — καμία απόφαση, όσο κι αν η πρόταση λέει «pending».
  it('παρτίδα που τελείωσε: καμία έγκριση, απόρριψη ή αποδοχή, ούτε σε εκκρεμή πρόταση', () => {
    setup(proposal([row([field({ decision: 'pending' })])]), false);
    expect(screen.queryByRole('button', { name: 'review.apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'review.rejectAll' })).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: '099-01-001' });
    expect(within(section).getByRole('radio', { name: 'review.accept' })).toBeDisabled();
    expect(within(section).getByRole('radio', { name: 'review.reject' })).toBeDisabled();
    expect(within(section).getByRole('button', { name: 'review.acceptRow' })).toBeDisabled();
  });

  describe('§5.5.2 Β4 — η πρόταση τιμών', () => {
    const priceTarget = { kind: 'price', field: 'netPrice' } as const;
    const priceRow = (issues: ImportProposalRow['issues'] = []) =>
      row([field({ target: priceTarget, sourceText: '574,74', incoming: { type: 'text', text: '574,74' } })], { holderId: issues.length > 0 ? null : 'cpr_1', action: 'update', issues });
    const prices = (rows: readonly ImportProposalRow[]) => proposal(rows, { purpose: 'priceLines', modelCode: null, groupKey: 'page:60:t0:prices' });

    it('ο τίτλος λέει «Τιμές», όχι «χωρίς μοντέλο», και δεν ζητά κωδικό μοντέλου', () => {
      setup(prices([priceRow()]));
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('review.pricesTitle');
      expect(screen.queryByLabelText('review.modelCode')).not.toBeInTheDocument();
    });

    it('🔴 SKU που περιμένουν τις ιδιότητες: η έγκριση κλειδώνει και λέει τι να γίνει πρώτα', () => {
      setup(prices([priceRow([{ code: 'awaitsAttributes', path: 'r0' }])]));
      expect(screen.getByRole('button', { name: 'review.apply' })).toBeDisabled();
      expect(screen.getByText('review.awaitsAttributes')).toBeInTheDocument();
    });

    it('χωρίς αναμονή: η έγκριση ανοίγει και καμία σημείωση αναμονής', () => {
      setup(prices([priceRow()]));
      expect(screen.getByRole('button', { name: 'review.apply' })).toBeEnabled();
      expect(screen.queryByText('review.awaitsAttributes')).not.toBeInTheDocument();
    });

    it('η πηγή της πρότασης (γραμμή, μονάδα, αναίρεση) αποδίδεται μέσα στην πρόταση', () => {
      const handlers = { onSelect: jest.fn(), onChange: jest.fn(), onApply: jest.fn(), onReject: jest.fn() };
      render(<ProposalReview proposal={prices([priceRow()])} selectedKey={null} batchOpen source={<p>price-source</p>} {...handlers} />);
      expect(screen.getByText('price-source')).toBeInTheDocument();
    });
  });

  it('χωρίς κωδικό μοντέλου ζητά τον κωδικό, και τον στέλνει', () => {
    const value = proposal([row([field()])], { modelCode: null });
    const { onChange } = setup(value);
    fireEvent.change(screen.getByLabelText('review.modelCode'), { target: { value: 'mfp' } });
    fireEvent.click(screen.getByRole('button', { name: 'review.setModelCode' }));
    expect(onChange).toHaveBeenCalledWith(value, { modelCode: 'mfp' });
  });
});
